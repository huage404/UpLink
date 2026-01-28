import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { Client } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools (commented out - default to not open)
  // mainWindow.webContents.openDevTools();
};

// 保存正在进行的上传任务（serverId -> { client, cancelled }）
const activeUploads = new Map();

// IPC handlers - 在 app.whenReady() 之前注册
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: '选择文件夹'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// 取消上传
ipcMain.handle('cancel-upload', async (event, serverId) => {
  const uploadTask = activeUploads.get(serverId);
  if (uploadTask) {
    uploadTask.cancelled = true;
    try {
      uploadTask.client.close();
    } catch (error) {
      // 忽略关闭连接时的错误
    }
    activeUploads.delete(serverId);
    return { success: true, message: '上传已取消' };
  }
  return { success: false, message: '未找到上传任务' };
});

// FTP / SFTP 上传处理函数
ipcMain.handle('upload-files', async (event, serverConfig) => {
  const serverId = serverConfig.id;
  // 连接模式：ftp / ftps-explicit / ftps-implicit / sftp
  const connectionMode = serverConfig.connectionMode || 'ftp';

  // 解析可选的文件过滤规则（正则字符串）
  let filterRegex = null;
  if (serverConfig.filterRule) {
    try {
      filterRegex = new RegExp(serverConfig.filterRule);
    } catch (error) {
      return {
        success: false,
        message: `过滤规则不合法: ${error.message}`,
        error: error.message
      };
    }
  }

  // 检查本地路径是否存在
  if (!fs.existsSync(serverConfig.localPath)) {
    return {
      success: false,
      message: `本地路径不存在: ${serverConfig.localPath}`,
      error: `本地路径不存在: ${serverConfig.localPath}`
    };
  }

  // SFTP 分支
  if (connectionMode === 'sftp') {
    const sftp = new SftpClient();
    // 保存上传任务
    activeUploads.set(serverId, { client: sftp, cancelled: false });

    try {
      // 解析服务器地址和端口
      const addressParts = serverConfig.address.split(':');
      const host = addressParts[0];
      const port = addressParts[1] ? parseInt(addressParts[1], 10) : 22;

      await sftp.connect({
        host,
        port,
        username: serverConfig.ftpUsername,
        password: serverConfig.ftpPassword
      });

      // 规范化服务器路径
      let serverPath = serverConfig.serverPath.replace(/\\/g, '/').replace(/\/$/, '');
      if (!serverPath.startsWith('/')) {
        serverPath = '/' + serverPath;
      }

      // 统计总文件数（考虑过滤规则）
      const totalFiles = countFiles(serverConfig.localPath, filterRegex);

      const sendProgress = (current, total, fileName) => {
        const uploadTask = activeUploads.get(serverId);
        if (uploadTask && uploadTask.cancelled) {
          throw new Error('上传已取消');
        }

        const progress = total > 0 ? Math.round((current / total) * 100) : 0;
        if (event && event.sender) {
          event.sender.send('upload-progress', {
            serverId: serverConfig.id,
            current,
            total,
            progress,
            fileName
          });
        }
      };

      const uploadResult = await uploadDirectorySftp(
        sftp,
        serverConfig.localPath,
        serverPath,
        [],
        sendProgress,
        0,
        totalFiles,
        serverId,
        filterRegex
      );

      let message = `上传完成！成功: ${uploadResult.fileCount} 个文件`;
      if (uploadResult.failedCount > 0) {
        const serverPermissionErrors = uploadResult.failedFiles.filter(f => f.includes('[服务器权限错误]'));
        const localErrors = uploadResult.failedFiles.filter(f => f.includes('[本地'));

        message += `，跳过: ${uploadResult.failedCount} 个文件`;
        if (serverPermissionErrors.length > 0) {
          message += `（其中 ${serverPermissionErrors.length} 个因服务器权限不足）`;
        }
        if (localErrors.length > 0) {
          message += `（其中 ${localErrors.length} 个因本地文件问题）`;
        }
      }
      if (uploadResult.failedFiles.length > 0 && uploadResult.failedFiles.length <= 10) {
        message += `\n\n跳过的文件:\n${uploadResult.failedFiles.join('\n')}`;
      } else if (uploadResult.failedFiles.length > 10) {
        message += `\n\n跳过的文件（前10个）:\n${uploadResult.failedFiles.slice(0, 10).join('\n')}\n...还有 ${uploadResult.failedFiles.length - 10} 个文件`;
      }

      if (event && event.sender) {
        event.sender.send('upload-progress', {
          serverId: serverConfig.id,
          completed: true,
          fileCount: uploadResult.fileCount,
          failedCount: uploadResult.failedCount
        });
      }

      return {
        success: uploadResult.fileCount > 0,
        message,
        fileCount: uploadResult.fileCount,
        failedCount: uploadResult.failedCount,
        failedFiles: uploadResult.failedFiles
      };
    } catch (error) {
      const uploadTask = activeUploads.get(serverId);
      const isCancelled = uploadTask && uploadTask.cancelled;

      if (event && event.sender) {
        event.sender.send('upload-progress', {
          serverId: serverConfig.id,
          error: isCancelled ? '上传已取消' : error.message,
          cancelled: isCancelled
        });
      }

      return {
        success: false,
        message: isCancelled ? '上传已取消' : `上传失败: ${error.message}`,
        error: isCancelled ? 'cancelled' : error.message,
        cancelled: isCancelled
      };
    } finally {
      activeUploads.delete(serverId);
      try {
        await sftp.end();
      } catch (error) {
        // 忽略关闭错误
      }
    }
  }

  // FTP / FTPS 分支
  const client = new Client();
  activeUploads.set(serverId, { client, cancelled: false });

  try {
    // 解析服务器地址和端口
    const addressParts = serverConfig.address.split(':');
    const host = addressParts[0];
    let port = addressParts[1] ? parseInt(addressParts[1], 10) : undefined;

    // 连接 FTP 服务器
    // 根据连接模式决定 secure 与默认端口
    let secureMode = false;
    if (connectionMode === 'ftps-implicit') {
      secureMode = 'implicit';
      if (!port) port = 990;
    } else if (connectionMode === 'ftps-explicit') {
      secureMode = true;
      if (!port) port = 21;
    } else {
      // 普通 FTP
      secureMode = false;
      if (!port) port = 21;
    }

    await client.access({
      host: host,
      port: port,
      user: serverConfig.ftpUsername,
      password: serverConfig.ftpPassword,
      secure: secureMode,
      secureOptions: secureMode
        ? {
            // 允许自签名证书，解决 "self signed certificate" 错误
            rejectUnauthorized: false
          }
        : undefined
    });

    // 规范化服务器路径（确保使用正斜杠，移除末尾斜杠）
    let serverPath = serverConfig.serverPath.replace(/\\/g, '/').replace(/\/$/, '');
    if (!serverPath.startsWith('/')) {
      serverPath = '/' + serverPath; // 确保是绝对路径
    }

    // 确保服务器路径存在
    try {
      await client.ensureDir(serverPath);
    } catch (error) {
      // 如果创建目录失败，可能是路径已存在或权限问题，继续尝试上传
    }

    // 切换到目标目录
    try {
      await client.cd(serverPath);
    } catch (error) {
      // 如果切换失败，尝试使用根目录或当前目录
    }

    // 统计总文件数（用于进度计算，考虑过滤规则）
    const totalFiles = countFiles(serverConfig.localPath, filterRegex);

    // 发送进度更新函数
    const sendProgress = (current, total, fileName) => {
      // 检查是否已取消
      const uploadTask = activeUploads.get(serverId);
      if (uploadTask && uploadTask.cancelled) {
        throw new Error('上传已取消');
      }

      const progress = total > 0 ? Math.round((current / total) * 100) : 0;
      if (event && event.sender) {
        event.sender.send('upload-progress', {
          serverId: serverConfig.id,
          current,
          total,
          progress,
          fileName
        });
      }
    };

    // 上传文件
    const uploadResult = await uploadDirectory(
      client,
      serverConfig.localPath,
      serverPath,
      [],
      sendProgress,
      0,
      totalFiles,
      serverId,
      filterRegex
    );

    // 构建返回消息
    let message = `上传完成！成功: ${uploadResult.fileCount} 个文件`;
    if (uploadResult.failedCount > 0) {
      // 统计错误类型
      const serverErrors = uploadResult.failedFiles.filter(f => f.includes('[服务器'));
      const localErrors = uploadResult.failedFiles.filter(f => f.includes('[本地'));
      const serverPermissionErrors = uploadResult.failedFiles.filter(f => f.includes('[服务器权限错误]'));

      message += `，跳过: ${uploadResult.failedCount} 个文件`;
      if (serverPermissionErrors.length > 0) {
        message += `（其中 ${serverPermissionErrors.length} 个因服务器权限不足）`;
      }
      if (localErrors.length > 0) {
        message += `（其中 ${localErrors.length} 个因本地文件问题）`;
      }
    }
    if (uploadResult.failedFiles.length > 0 && uploadResult.failedFiles.length <= 10) {
      message += `\n\n跳过的文件:\n${uploadResult.failedFiles.join('\n')}`;
    } else if (uploadResult.failedFiles.length > 10) {
      message += `\n\n跳过的文件（前10个）:\n${uploadResult.failedFiles.slice(0, 10).join('\n')}\n...还有 ${uploadResult.failedFiles.length - 10} 个文件`;
    }

    // 发送完成进度
    if (event && event.sender) {
      event.sender.send('upload-progress', {
        serverId: serverConfig.id,
        completed: true,
        fileCount: uploadResult.fileCount,
        failedCount: uploadResult.failedCount
      });
    }

    return {
      success: uploadResult.fileCount > 0, // 只要有文件上传成功就返回成功
      message: message,
      fileCount: uploadResult.fileCount,
      failedCount: uploadResult.failedCount,
      failedFiles: uploadResult.failedFiles
    };
  } catch (error) {
    // 检查是否是取消操作
    const uploadTask = activeUploads.get(serverId);
    const isCancelled = uploadTask && uploadTask.cancelled;

    // 发送错误进度
    if (event && event.sender) {
      event.sender.send('upload-progress', {
        serverId: serverConfig.id,
        error: isCancelled ? '上传已取消' : error.message,
        cancelled: isCancelled
      });
    }

    return {
      success: false,
      message: isCancelled ? '上传已取消' : `上传失败: ${error.message}`,
      error: isCancelled ? 'cancelled' : error.message,
      cancelled: isCancelled
    };
  } finally {
    // 清理上传任务
    activeUploads.delete(serverId);
    try {
      client.close();
    } catch (error) {
      // 忽略关闭连接时的错误
    }
  }
});

// SFTP 递归上传目录
async function uploadDirectorySftp(
  sftp,
  localDir,
  remoteDir,
  failedFiles = [],
  sendProgress = null,
  currentCount = 0,
  totalFiles = 0,
  serverId = null,
  filterRegex = null
) {
  let fileCount = 0;
  let failedCount = 0;

  // 规范化远程目录路径
  let normalizedRemoteDir = remoteDir.replace(/\\/g, '/').replace(/\/$/, '');
  if (!normalizedRemoteDir.startsWith('/')) {
    normalizedRemoteDir = '/' + normalizedRemoteDir;
  }

  // 确保远程目录存在
  await ensureRemoteDirSftp(sftp, normalizedRemoteDir);

  // 读取本地目录内容
  let items;
  try {
    items = fs.readdirSync(localDir, { withFileTypes: true });
  } catch (error) {
    throw new Error(`无法读取本地目录: ${error.message}`);
  }

  for (const item of items) {
    const localPath = path.join(localDir, item.name);
    const fileName = item.name;

    // 如果有过滤规则，匹配到名称则直接跳过（文件和目录都跳过）
    if (filterRegex && filterRegex.test(fileName)) {
      continue;
    }

    // 检查本地文件/目录是否存在和可访问
    try {
      const stats = fs.statSync(localPath);
      if (!stats.isDirectory() && !stats.isFile()) {
        continue;
      }
    } catch (error) {
      failedFiles.push(`[本地错误] ${localPath}`);
      failedCount++;
      continue;
    }

    if (item.isDirectory()) {
      const subRemoteDir = normalizedRemoteDir + '/' + fileName;
      try {
        await ensureRemoteDirSftp(sftp, subRemoteDir);
        const result = await uploadDirectorySftp(
          sftp,
          localPath,
          subRemoteDir,
          failedFiles,
          sendProgress,
          currentCount + fileCount,
          totalFiles,
          serverId,
          filterRegex
        );
        fileCount += result.fileCount;
        failedCount += result.failedCount;
      } catch (error) {
        const errorType = error.message && (error.message.includes('Permission') || error.message.includes('permission'))
          ? '[服务器权限错误]'
          : '[服务器错误]';
        failedFiles.push(`${errorType} ${subRemoteDir}/`);
        failedCount++;
      }
    } else if (item.isFile()) {
      const remoteFilePath = normalizedRemoteDir + '/' + fileName;

      try {
        fs.accessSync(localPath, fs.constants.R_OK);
      } catch (error) {
        failedFiles.push(`[本地错误] ${localPath}`);
        failedCount++;
        if (sendProgress) {
          sendProgress(currentCount + fileCount + 1, totalFiles, fileName);
        }
        continue;
      }

      try {
        // 上传文件
        await sftp.fastPut(localPath, remoteFilePath);
        fileCount++;
        if (sendProgress) {
          sendProgress(currentCount + fileCount, totalFiles, fileName);
        }
      } catch (error) {
        const isPermissionError = error.message && (error.message.includes('Permission') || error.message.includes('permission'));
        const errorType = isPermissionError ? '[服务器权限错误]' : '[服务器错误]';

        failedFiles.push(`${errorType} ${remoteFilePath}`);
        failedCount++;
        if (sendProgress) {
          sendProgress(currentCount + fileCount + 1, totalFiles, fileName);
        }
      }
    }
  }

  return { fileCount, failedCount, failedFiles };
}

// 确保 SFTP 远程目录存在
async function ensureRemoteDirSftp(sftp, remoteDir) {
  const parts = remoteDir.replace(/\\/g, '/').split('/').filter(Boolean);
  let current = remoteDir.startsWith('/') ? '/' : '';

  for (const part of parts) {
    current = current === '/' ? `/${part}` : `${current}/${part}`;
    try {
      const exists = await sftp.exists(current);
      if (!exists) {
        await sftp.mkdir(current);
      }
    } catch (error) {
      // 如果是权限问题等，抛出去由上层处理
      throw error;
    }
  }
}

// 统计文件总数（递归，可选过滤规则）
function countFiles(dirPath, filterRegex = null) {
  let count = 0;
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      // 有过滤规则时，匹配到名称就跳过
      if (filterRegex && filterRegex.test(item.name)) {
        continue;
      }
      if (item.isDirectory()) {
        count += countFiles(itemPath, filterRegex);
      } else if (item.isFile()) {
        count++;
      }
    }
  } catch (error) {
    // 忽略无法访问的目录
  }
  return count;
}

// 递归上传目录
async function uploadDirectory(
  client,
  localDir,
  remoteDir,
  failedFiles = [],
  sendProgress = null,
  currentCount = 0,
  totalFiles = 0,
  serverId = null,
  filterRegex = null
) {
  let fileCount = 0;
  let failedCount = 0;
  
  // 检查是否已取消
  if (serverId) {
    const uploadTask = activeUploads.get(serverId);
    if (uploadTask && uploadTask.cancelled) {
      throw new Error('上传已取消');
    }
  }
  
  // 规范化远程目录路径
  let normalizedRemoteDir = remoteDir.replace(/\\/g, '/').replace(/\/$/, '');
  if (!normalizedRemoteDir.startsWith('/')) {
    normalizedRemoteDir = '/' + normalizedRemoteDir;
  }
  
  // 确保远程目录存在
  try {
    await client.ensureDir(normalizedRemoteDir);
  } catch (error) {
    // 如果创建目录失败，可能是权限问题，但继续尝试
  }
  
  // 切换到远程目录
  try {
    await client.cd(normalizedRemoteDir);
  } catch (error) {
    // 如果切换目录失败，可能是权限问题，但继续尝试上传文件
  }
  
  // 读取本地目录内容
  let items;
  try {
    items = fs.readdirSync(localDir, { withFileTypes: true });
  } catch (error) {
    throw new Error(`无法读取本地目录: ${error.message}`);
  }
  
  for (const item of items) {
    const localPath = path.join(localDir, item.name);
    const fileName = item.name;
    
    // 如果有过滤规则，匹配到名称则直接跳过（文件和目录都跳过）
    if (filterRegex && filterRegex.test(fileName)) {
      continue;
    }
    
    // 检查本地文件/目录是否存在和可访问
    try {
      const stats = fs.statSync(localPath);
      if (!stats.isDirectory() && !stats.isFile()) {
        continue;
      }
    } catch (error) {
      failedFiles.push(`[本地错误] ${localPath}`);
      failedCount++;
      continue;
    }
    
    if (item.isDirectory()) {
      // 创建子目录并递归上传
      const subRemoteDir = normalizedRemoteDir + '/' + fileName;
      try {
        await client.ensureDir(subRemoteDir);
        const result = await uploadDirectory(
          client, 
          localPath, 
          subRemoteDir, 
          failedFiles, 
          sendProgress,
          currentCount + fileCount,
          totalFiles,
          serverId,
          filterRegex
        );
        fileCount += result.fileCount;
        failedCount += result.failedCount;
      } catch (error) {
        // 子目录上传失败，记录但继续处理其他文件
        const errorType = error.message.includes('553') || error.message.includes('Permission') 
          ? '[服务器权限错误]' 
          : '[服务器错误]';
        failedFiles.push(`${errorType} ${subRemoteDir}/`);
        failedCount++;
      }
    } else if (item.isFile()) {
      // 上传文件（使用绝对路径）
      const remoteFilePath = normalizedRemoteDir + '/' + fileName;
      
      // 检查本地文件是否可读
      try {
        fs.accessSync(localPath, fs.constants.R_OK);
      } catch (error) {
        failedFiles.push(`[本地错误] ${localPath}`);
        failedCount++;
        if (sendProgress) {
          sendProgress(currentCount + fileCount + 1, totalFiles, fileName);
        }
        continue;
      }
      
      try {
        // 检查是否已取消
        if (serverId) {
          const uploadTask = activeUploads.get(serverId);
          if (uploadTask && uploadTask.cancelled) {
            throw new Error('上传已取消');
          }
        }
        
        // 先确保在正确的目录
        await client.cd(normalizedRemoteDir);
        // 上传文件
        await client.uploadFrom(localPath, remoteFilePath);
        fileCount++;
        if (sendProgress) {
          sendProgress(currentCount + fileCount, totalFiles, fileName);
        }
      } catch (error) {
        // 如果是取消操作，直接抛出
        if (error.message === '上传已取消') {
          throw error;
        }
        // 判断错误类型
        const isPermissionError = error.message.includes('553') || 
                                  error.message.includes('Permission') ||
                                  error.message.includes('permission');
        const errorType = isPermissionError ? '[服务器权限错误]' : '[服务器错误]';
        
        // 如果使用绝对路径失败，尝试使用相对路径
        try {
          await client.uploadFrom(localPath, fileName);
          fileCount++;
          if (sendProgress) {
            sendProgress(currentCount + fileCount, totalFiles, fileName);
          }
        } catch (retryError) {
          // 两种方式都失败，跳过这个文件
          failedFiles.push(`${errorType} ${remoteFilePath}`);
          failedCount++;
          if (sendProgress) {
            sendProgress(currentCount + fileCount + 1, totalFiles, fileName);
          }
        }
      }
    }
  }
  
  return { fileCount, failedCount, failedFiles };
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
