<template>
  <div class="home">
    <div class="header">
      <h1>服务器列表</h1>
      <button class="add-btn" @click="handleAddServer">+ 添加服务器</button>
    </div>
    
    <div class="server-list">
      <div 
        v-for="server in servers" 
        :key="server.id" 
        class="server-card"
      >
        <div class="card-header">
          <h2 class="server-name">{{ server.name }}</h2>
          <div class="card-actions">
            <button class="action-btn edit" @click="handleEdit(server)">编辑</button>
            <button class="action-btn delete" @click="handleDelete(server.id)">删除</button>
          </div>
        </div>
        
        <div class="card-content">
          <div class="info-item">
            <span class="label">服务器地址：</span>
            <span class="value">{{ server.address }}</span>
          </div>
          <div class="info-item">
            <span class="label">FTP 账号名：</span>
            <span class="value">{{ server.ftpUsername }}</span>
          </div>
          <div class="info-item">
            <span class="label">服务器路径：</span>
            <span class="value">{{ server.serverPath }}</span>
          </div>
          <div class="info-item">
            <span class="label">本机路径：</span>
            <span class="value">{{ server.localPath }}</span>
          </div>
          <div 
            v-if="server.filterRule" 
            class="info-item"
          >
            <span class="label">过滤规则：</span>
            <span class="value">{{ server.filterRule }}</span>
          </div>
        </div>
        
        <div class="card-footer">
          <div class="upload-actions">
            <template v-if="!server.uploading">
              <button 
                class="upload-btn" 
                @click="handleUpload(server)"
              >
                <span class="upload-icon">↑</span>
                上传
              </button>
            </template>
            <template v-else>
              <button 
                class="cancel-btn" 
                @click="handleCancelUpload(server)"
              >
                <span class="cancel-icon">×</span>
                取消
              </button>
              <button 
                class="log-btn" 
                @click="handleViewLog(server)"
              >
                查看日志
              </button>
            </template>
          </div>
          
          <!-- 进度条 -->
          <div v-if="server.uploadProgress" class="upload-progress-container">
            <div class="progress-info">
              <span class="progress-text">
                {{ server.uploadProgress.current }}/{{ server.uploadProgress.total }} 
                ({{ server.uploadProgress.progress }}%)
              </span>
              <span v-if="server.uploadProgress.fileName" class="current-file">
                正在上传: {{ server.uploadProgress.fileName }}
              </span>
            </div>
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: server.uploadProgress.progress + '%' }"
              ></div>
            </div>
          </div>
          
          <div v-if="server.uploadStatus" :class="['upload-status', server.uploadStatus.type]">
            {{ server.uploadStatus.message }}
          </div>
        </div>
      </div>
      
      <div v-if="servers.length === 0" class="empty-state">
        <p>暂无服务器配置</p>
        <button class="add-btn" @click="handleAddServer">添加第一个服务器</button>
      </div>
    </div>

    <!-- 日志侧边栏 -->
    <div 
      v-if="showLogPanel && currentLogServer" 
      class="log-panel-overlay" 
      @click="handleCloseLogPanel"
    >
      <div class="log-panel" @click.stop>
        <div class="log-panel-header">
          <div class="log-title-group">
            <h2>上传日志</h2>
            <span class="log-subtitle">{{ currentLogServer.name }}</span>
          </div>
          <button class="close-btn" @click="handleCloseLogPanel">×</button>
        </div>
        <div class="log-panel-body">
          <div class="log-content">
            <div 
              v-if="serverLogs[currentLogServer.id] && serverLogs[currentLogServer.id].length"
              class="log-lines"
            >
              <div 
                v-for="(line, index) in serverLogs[currentLogServer.id]" 
                :key="index" 
                class="log-line"
              >
                {{ line }}
              </div>
            </div>
            <div v-else class="log-empty">
              暂无日志
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑服务器弹窗 -->
    <div v-if="showDialog" class="dialog-overlay" @click="handleCloseDialog">
      <div class="dialog-content" @click.stop>
        <div class="dialog-header">
          <h2>{{ editingServer ? '编辑服务器' : '添加服务器' }}</h2>
          <button class="close-btn" @click="handleCloseDialog">×</button>
        </div>
        
        <form class="dialog-form" @submit.prevent="handleSubmit">
          <div class="form-item">
            <label>服务器名字 <span class="required">*</span></label>
            <input 
              v-model.trim="formData.name" 
              type="text" 
              placeholder="请输入服务器名字"
              required
            />
          </div>
          
          <div class="form-item">
            <label>服务器地址 <span class="required">*</span></label>
            <input 
              v-model.trim="formData.address" 
              type="text" 
              placeholder="例如：192.168.1.100:21"
              required
            />
          </div>
          
          <div class="form-item">
            <label>连接模式 <span class="required">*</span></label>
            <select v-model="formData.connectionMode">
              <option value="ftp">普通 FTP（不加密）</option>
              <option value="ftps-explicit">显式 FTPS（FTPES，通常端口 21）</option>
              <option value="ftps-implicit">隐式 FTPS（通常端口 990）</option>
              <option value="sftp">SFTP（基于 SSH，通常端口 22）</option>
            </select>
          </div>
          
          <div class="form-item">
            <label>FTP 账号名 <span class="required">*</span></label>
            <input 
              v-model.trim="formData.ftpUsername" 
              type="text" 
              placeholder="请输入 FTP 账号名"
              required
            />
          </div>
          
          <div class="form-item">
            <label>FTP 密码 <span class="required">*</span></label>
            <div class="password-wrapper">
              <input 
                v-model.trim="formData.ftpPassword" 
                :type="showPassword ? 'text' : 'password'" 
                placeholder="请输入 FTP 密码"
                required
              />
              <button
                type="button"
                class="password-toggle-btn"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? '隐藏' : '显示' }}
              </button>
            </div>
          </div>
          
          <div class="form-item">
            <label>服务器路径 <span class="required">*</span></label>
            <input 
              v-model.trim="formData.serverPath" 
              type="text" 
              placeholder="例如：/var/www/html"
              required
            />
          </div>
          
          <div class="form-item">
            <label>本机路径 <span class="required">*</span></label>
            <div class="path-selector">
              <input 
                v-model.trim="formData.localPath" 
                type="text" 
                placeholder="请选择文件夹"
                readonly
                required
                class="path-input"
              />
              <button 
                type="button" 
                class="select-btn"
                @click="handleSelectFolder"
              >
                选择文件夹
              </button>
            </div>
          </div>
          
          <div class="form-item">
            <label>文件过滤规则（可选）</label>
            <input
              v-model.trim="formData.filterRule"
              type="text"
              placeholder="输入正则表达式，例如：\\.log$ 或 node_modules"
            />
            <p class="form-item-desc">
              匹配到的文件或文件夹将被跳过（不上传）。
            </p>
          </div>
          
          <div class="form-actions">
            <button type="button" class="cancel-btn" @click="handleCloseDialog">取消</button>
            <button type="submit" class="submit-btn">保存</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const STORAGE_KEY = 'uplink_servers'

// 服务器列表数据
const servers = ref([])

// 弹窗控制
const showDialog = ref(false)
const editingServer = ref(null)

// 日志侧边栏
const showLogPanel = ref(false)
const currentLogServer = ref(null)
const serverLogs = ref({})

// 表单数据
const formData = ref({
  name: '',
  address: '',
  ftpUsername: '',
  ftpPassword: '',
  serverPath: '',
  localPath: '',
  connectionMode: 'ftp', // 连接模式：ftp / ftps-explicit / ftps-implicit
  filterRule: '' // 文件过滤规则（正则字符串，可选）
})

// 密码显示控制
const showPassword = ref(false)

// 确保日志数组存在
const ensureServerLog = (serverId) => {
  if (!serverLogs.value[serverId]) {
    serverLogs.value[serverId] = []
  }
}

// 打开日志侧边栏
const handleViewLog = (server) => {
  currentLogServer.value = server
  ensureServerLog(server.id)
  showLogPanel.value = true
}

// 关闭日志侧边栏
const handleCloseLogPanel = () => {
  showLogPanel.value = false
}

// 从缓存加载数据
const loadServers = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const loadedServers = JSON.parse(stored)
      // 为每个服务器初始化上传状态
      servers.value = loadedServers.map(server => ({
        ...server,
        // 兼容旧数据，没有 connectionMode 时默认使用普通 FTP
        connectionMode: server.connectionMode || 'ftp',
        uploading: false,
        uploadProgress: null,
        uploadStatus: null
      }))
    }
  } catch (error) {
    console.error('加载服务器数据失败:', error)
  }
}

// 保存数据到缓存
const saveServers = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servers.value))
  } catch (error) {
    console.error('保存服务器数据失败:', error)
  }
}

// 添加服务器
const handleAddServer = () => {
  editingServer.value = null
  formData.value = {
    name: '',
    address: '',
    ftpUsername: '',
    ftpPassword: '',
    serverPath: '',
    localPath: '',
    connectionMode: 'ftp',
    filterRule: ''
  }
  showPassword.value = false
  showDialog.value = true
}

// 编辑服务器
const handleEdit = (server) => {
  editingServer.value = server
  formData.value = {
    name: server.name,
    address: server.address,
    ftpUsername: server.ftpUsername,
    ftpPassword: server.ftpPassword || '',
    serverPath: server.serverPath,
    localPath: server.localPath,
    connectionMode: server.connectionMode || 'ftp',
    filterRule: server.filterRule || ''
  }
  showPassword.value = false
  showDialog.value = true
}

// 关闭弹窗
const handleCloseDialog = () => {
  showDialog.value = false
  editingServer.value = null
  formData.value = {
    name: '',
    address: '',
    ftpUsername: '',
    ftpPassword: '',
    serverPath: '',
    localPath: '',
    connectionMode: 'ftp',
    filterRule: ''
  }
  showPassword.value = false
}

// 提交表单
const handleSubmit = () => {
  // 提交前对字符串字段做 trim 处理
  const trimmed = {
    ...formData.value,
    name: formData.value.name.trim(),
    address: formData.value.address.trim(),
    ftpUsername: formData.value.ftpUsername.trim(),
    ftpPassword: formData.value.ftpPassword.trim(),
    serverPath: formData.value.serverPath.trim(),
    localPath: formData.value.localPath.trim(),
    filterRule: (formData.value.filterRule || '').trim()
  }

  if (editingServer.value) {
    // 编辑模式
    const index = servers.value.findIndex(s => s.id === editingServer.value.id)
    if (index !== -1) {
      servers.value[index] = {
        ...editingServer.value,
        ...trimmed
      }
    }
  } else {
    // 新增模式
    const newServer = {
      id: Date.now(),
      ...trimmed,
      uploading: false,
      uploadProgress: null,
      uploadStatus: null
    }
    servers.value.push(newServer)
  }
  
  saveServers()
  handleCloseDialog()
}

// 删除服务器
const handleDelete = (id) => {
  if (confirm('确定要删除这个服务器配置吗？')) {
    servers.value = servers.value.filter(s => s.id !== id)
    saveServers()
  }
}

// 上传文件
const handleUpload = async (server) => {
  // 验证服务器配置
  if (!server.address || !server.ftpUsername || !server.ftpPassword || !server.serverPath || !server.localPath) {
    return
  }
  
  // 确认上传
  if (!confirm(`确定要上传本地文件夹 "${server.localPath}" 到服务器 "${server.name}" 的 "${server.serverPath}" 路径吗？`)) {
    return
  }
  
  // 初始化上传状态
  server.uploading = true
  server.uploadProgress = null
  server.uploadStatus = null
  
  try {
    if (!window.electronAPI || !window.electronAPI.uploadFiles) {
      throw new Error('Electron API 未可用，请在 Electron 环境中使用')
    }
    
    const result = await window.electronAPI.uploadFiles({
      id: server.id,
      address: server.address,
      ftpUsername: server.ftpUsername,
      ftpPassword: server.ftpPassword,
      serverPath: server.serverPath,
      localPath: server.localPath,
      connectionMode: server.connectionMode || 'ftp',
      filterRule: server.filterRule || ''
    })
    
    // 根据结果设置状态
    if (result.fileCount > 0) {
      // 有文件上传成功
      if (result.failedCount > 0) {
        // 有部分文件失败，显示警告
        server.uploadStatus = {
          type: 'warning',
          message: result.message
        }
      } else {
        // 全部成功
        server.uploadStatus = {
          type: 'success',
          message: result.message
        }
      }
    } else {
      // 没有文件上传成功
      // 检查是否是取消操作
      if (result.cancelled) {
        server.uploadStatus = {
          type: 'warning',
          message: '上传已取消'
        }
      } else {
        server.uploadStatus = {
          type: 'error',
          message: result.message || '上传失败：没有文件成功上传'
        }
      }
    }
  } catch (error) {
    console.error('上传失败:', error)
    const errorMessage = error.message || '上传过程中发生未知错误'
    const isCancelled = errorMessage.includes('上传已取消') || errorMessage === 'cancelled'
    
    if (!isCancelled) {
      server.uploadStatus = {
        type: 'error',
        message: errorMessage
      }
    } else {
      server.uploadStatus = {
        type: 'warning',
        message: '上传已取消'
      }
    }
    server.uploading = false
  } finally {
    server.uploading = false
  }
}

// 取消上传
const handleCancelUpload = async (server) => {
  if (!confirm('确定要取消上传吗？')) {
    return
  }
  
  try {
    if (window.electronAPI && window.electronAPI.cancelUpload) {
      await window.electronAPI.cancelUpload(server.id)
      server.uploading = false
      server.uploadProgress = null
      server.uploadStatus = {
        type: 'warning',
        message: '上传已取消'
      }
    }
  } catch (error) {
    console.error('取消上传失败:', error)
  }
}

// 选择文件夹
const handleSelectFolder = async () => {
  try {
    console.log('window.electronAPI:', window.electronAPI)
    if (window.electronAPI && window.electronAPI.selectFolder) {
      console.log('调用 selectFolder...')
      const path = await window.electronAPI.selectFolder()
      console.log('选择的路径:', path)
      if (path) {
        formData.value.localPath = path
      }
    } else {
      // 降级方案：使用 HTML5 文件选择器（仅用于开发测试）
      console.error('Electron API 未可用')
      console.log('window 对象:', window)
    }
  } catch (error) {
    console.error('选择文件夹失败:', error)
    console.error('错误详情:', error.message, error.stack)
  }
}

// 设置全局进度监听器（只设置一次）
const setupProgressListener = () => {
  if (window.electronAPI && window.electronAPI.onUploadProgress) {
    window.electronAPI.onUploadProgress((data) => {
      // 找到对应的服务器并更新进度
      const server = servers.value.find(s => s.id === data.serverId)
      if (!server) return

      // 初始化日志
      ensureServerLog(data.serverId)
      const logs = serverLogs.value[data.serverId]
      const time = new Date().toLocaleTimeString()

      if (data.error) {
        server.uploadStatus = {
          type: 'error',
          message: `上传失败: ${data.error}`
        }
        server.uploading = false
        logs.push(`[${time}] 错误：${data.error}`)
      } else if (data.completed) {
        server.uploading = false
        server.uploadProgress = null
        logs.push(`[${time}] 上传完成，成功 ${data.fileCount} 个文件，失败 ${data.failedCount} 个文件`)
      } else if (data.cancelled) {
        server.uploading = false
        server.uploadProgress = null
        server.uploadStatus = {
          type: 'warning',
          message: '上传已取消'
        }
        logs.push(`[${time}] 上传已取消`)
      } else if (typeof data.current === 'number' && typeof data.total === 'number') {
        server.uploadProgress = {
          current: data.current || 0,
          total: data.total || 0,
          progress: data.progress || 0,
          fileName: data.fileName || ''
        }
        if (data.fileName) {
          logs.push(
            `[${time}] 上传 ${data.fileName} (${server.uploadProgress.current}/${server.uploadProgress.total}，${server.uploadProgress.progress}%)`
          )
        }
      }
    })
  }
}

// 组件挂载时加载数据
onMounted(() => {
  loadServers()
  setupProgressListener()
})
</script>

<style scoped>
.home {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h1 {
  margin: 0;
  font-size: 2rem;
  color: #2c3e50;
}

.add-btn {
  background: #42b983;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

.add-btn:hover {
  background: #35a372;
}

.server-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.server-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s, transform 0.2s;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.server-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e0e0e0;
}

.server-name {
  margin: 0;
  font-size: 1.1rem;
  color: #2c3e50;
  font-weight: 600;
}

.card-actions {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  padding: 0.35rem 0.65rem;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.edit {
  background: #f0f0f0;
  color: #2c3e50;
}

.action-btn.edit:hover {
  background: #e0e0e0;
}

.action-btn.delete {
  background: #ff6b6b;
  color: white;
}

.action-btn.delete:hover {
  background: #ff5252;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.label {
  font-weight: 500;
  color: #666;
  min-width: 75px;
  flex-shrink: 0;
}

.value {
  color: #2c3e50;
  word-break: break-all;
  flex: 1;
}

.card-footer {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.upload-btn {
  width: 100%;
  padding: 0.75rem;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.upload-btn:hover {
  background: #35a372;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(66, 185, 131, 0.3);
}

.upload-btn:active {
  transform: translateY(0);
}

.upload-actions {
  display: flex;
  gap: 0.5rem;
}

.cancel-btn {
  width: 100%;
  padding: 0.75rem;
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #ff5252;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}

.cancel-btn:active {
  transform: translateY(0);
}

.cancel-icon {
  font-size: 1.2rem;
  font-weight: bold;
  line-height: 1;
}

.log-btn {
  width: 100%;
  padding: 0.75rem;
  background: #f0f0f0;
  color: #2c3e50;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.log-btn:hover {
  background: #e0e0e0;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.log-btn:active {
  transform: translateY(0);
}

.upload-icon {
  font-size: 1.1rem;
  font-weight: bold;
}

.upload-status {
  margin-top: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  text-align: center;
}

.upload-status.success {
  background: #d4edda;
  color: #155724;
}

.upload-status.warning {
  background: #fff3cd;
  color: #856404;
}

.upload-status.error {
  background: #f8d7da;
  color: #721c24;
}

.upload-progress-container {
  margin-top: 0.75rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.progress-text {
  color: #2c3e50;
  font-weight: 500;
}

.current-file {
  color: #666;
  font-size: 0.8rem;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #42b983, #35a372);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem 2rem;
  color: #999;
}

.empty-state p {
  font-size: 1.2rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 1024px) {
  .server-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .server-list {
    grid-template-columns: 1fr;
  }
  
  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .add-btn {
    width: 100%;
  }
}

/* 弹窗样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #2c3e50;
}

.dialog-form {
  padding: 1.5rem;
}

.form-item {
  margin-bottom: 1.5rem;
}

.form-item label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
  font-size: 0.9rem;
}

.form-item-desc {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: #777;
}

.required {
  color: #ff6b6b;
}

.form-item input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-item select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background-color: #fff;
}

.form-item select:focus {
  outline: none;
  border-color: #42b983;
}

.form-item input:focus {
  outline: none;
  border-color: #42b983;
}

.path-selector {
  display: flex;
  gap: 0.5rem;
}

.path-input {
  flex: 1;
  background-color: #f5f5f5;
  cursor: pointer;
}

.path-input:hover {
  background-color: #eeeeee;
}

.password-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.password-wrapper input {
  flex: 1;
}

.password-toggle-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}

.password-toggle-btn:hover {
  background: #e0e0e0;
}

.select-btn {
  padding: 0.75rem 1.5rem;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}

.select-btn:hover {
  background: #35a372;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e0e0e0;
}

.cancel-btn,
.submit-btn {
  padding: 0.75rem 1.5rem;
  min-width: 120px;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: #f0f0f0;
  color: #2c3e50;
}

.cancel-btn:hover {
  background: #e0e0e0;
}

.submit-btn {
  background: #42b983;
  color: white;
}

/* 日志侧边栏 */
.log-panel-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: flex-end;
  z-index: 900;
}

.log-panel {
  width: 420px;
  max-width: 100%;
  background: #1e1e1e;
  color: #f5f5f5;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.4);
}

.log-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #333;
}

.log-title-group h2 {
  margin: 0;
  font-size: 1.1rem;
}

.log-subtitle {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: #bbbbbb;
}

.log-panel-body {
  flex: 1;
  padding: 0.75rem 1.25rem 1.25rem;
  overflow: hidden;
}

.log-content {
  background: #111;
  border-radius: 4px;
  padding: 0.75rem;
  height: 100%;
  overflow-y: auto;
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 0.8rem;
}

.log-lines {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.log-line {
  white-space: pre-wrap;
  word-break: break-all;
}

.log-empty {
  text-align: center;
  color: #888;
  padding: 1.5rem 0;
}

.submit-btn:hover {
  background: #35a372;
}
</style>
