<template>
  <div class="task-management">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">任务管理</h1>
        <p class="page-desc">创建任务并批量上传到多个服务器</p>
      </div>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        创建任务
      </el-button>
    </div>

    <div v-if="tasks.length > 0" class="task-list">
      <el-row :gutter="16">
        <el-col
          v-for="task in tasks"
          :key="task.id"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
        >
          <el-card class="task-card" shadow="hover">
            <template #header>
              <div class="task-card-header">
                <span class="task-name">{{ task.name }}</span>
              </div>
            </template>
            <div class="task-servers">
              <el-tag
                v-for="sid in task.serverIds"
                :key="sid"
                size="small"
                class="server-tag"
              >
                {{ getServerName(sid) }}
              </el-tag>
              <span v-if="task.serverIds.length === 0" class="no-servers">未选择服务器</span>
            </div>
            <div class="task-actions">
              <el-button
                type="primary"
                size="small"
                :loading="task.uploading"
                :disabled="task.serverIds.length === 0"
                @click="handleTaskUpload(task)"
              >
                <el-icon v-if="!task.uploading"><Upload /></el-icon>
                {{ task.uploading ? '上传中...' : '上传' }}
              </el-button>
              <el-button size="small" link @click="handleViewLog(task)">查看日志</el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-empty v-else description="暂无任务，点击「创建任务」添加" :image-size="120">
      <el-button type="primary" @click="showCreateDialog = true">创建任务</el-button>
    </el-empty>

    <!-- 创建任务弹窗 -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建任务"
      width="480px"
      destroy-on-close
      @close="handleCloseCreateDialog"
    >
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px" label-position="top">
        <el-form-item label="任务名称" prop="name">
          <el-input v-model.trim="createForm.name" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="选择服务器" prop="serverIds">
          <el-select
            v-model="createForm.serverIds"
            multiple
            placeholder="请选择要上传的服务器"
            style="width: 100%"
          >
            <el-option
              v-for="s in servers"
              :key="s.id"
              :label="`${s.name} (${s.address})`"
              :value="s.id"
            />
          </el-select>
          <p class="form-tip">可选择首页已添加的服务器，任务创建后可批量上传</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmCreate">确认</el-button>
      </template>
    </el-dialog>

    <!-- 日志抽屉 -->
    <el-drawer
      v-model="showLogPanel"
      title="上传日志"
      direction="rtl"
      size="420px"
    >
      <template v-if="currentLogTask">
        <div class="log-subtitle">{{ currentLogTask.name }}</div>
        <div class="log-content">
          <div v-if="taskLogs[currentLogTask.id]?.length" class="log-lines">
            <div v-for="(line, index) in taskLogs[currentLogTask.id]" :key="index" class="log-line">{{ line }}</div>
          </div>
          <el-empty v-else description="暂无日志" :image-size="60" />
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Upload } from '@element-plus/icons-vue';

const STORAGE_KEY = 'uplink_servers';
const TASKS_STORAGE_KEY = 'uplink_tasks';

const servers = ref([]);
const tasks = ref([]);
const showCreateDialog = ref(false);
const createFormRef = ref(null);
const showLogPanel = ref(false);
const currentLogTask = ref(null);
const taskLogs = ref({});
const currentUploadingTaskId = ref(null);

const createForm = ref({
  name: '',
  serverIds: []
});

const createRules = {
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  serverIds: [{ required: true, message: '请至少选择一个服务器', trigger: 'change', type: 'array', min: 1 }]
};

const loadServers = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      servers.value = JSON.parse(stored);
    } else {
      servers.value = [];
    }
  } catch (e) {
    servers.value = [];
  }
};

const loadTasks = () => {
  try {
    const stored = localStorage.getItem(TASKS_STORAGE_KEY);
    if (stored) {
      tasks.value = JSON.parse(stored).map(t => ({
        ...t,
        uploading: false
      }));
    } else {
      tasks.value = [];
    }
  } catch (e) {
    tasks.value = [];
  }
};

const saveTasks = () => {
  const toSave = tasks.value.map(({ uploading, ...rest }) => rest);
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(toSave));
};

const getServerName = (serverId) => {
  const s = servers.value.find(x => x.id === serverId);
  return s ? s.name : `服务器 #${serverId}`;
};

const getServerById = (serverId) => {
  return servers.value.find(x => x.id === serverId);
};

const ensureTaskLog = (taskId) => {
  if (!taskLogs.value[taskId]) taskLogs.value[taskId] = [];
};

const handleViewLog = (task) => {
  currentLogTask.value = task;
  ensureTaskLog(task.id);
  showLogPanel.value = true;
};

const handleCloseCreateDialog = () => {
  createForm.value = { name: '', serverIds: [] };
};

const handleConfirmCreate = async () => {
  try {
    await createFormRef.value?.validate();
  } catch {
    return;
  }
  const task = {
    id: Date.now(),
    name: createForm.value.name.trim(),
    serverIds: [...createForm.value.serverIds],
    uploading: false
  };
  tasks.value.push(task);
  saveTasks();
  showCreateDialog.value = false;
  ElMessage.success('任务创建成功');
};

const getUploadConfig = (server) => ({
  id: server.id,
  address: server.address,
  ftpUsername: server.ftpUsername,
  ftpPassword: server.ftpPassword,
  serverPath: server.serverPath,
  localPath: server.localPath,
  connectionMode: server.connectionMode || 'ftp',
  filterRule: server.filterRule || ''
});

const appendTaskLog = (taskId, line) => {
  ensureTaskLog(taskId);
  taskLogs.value[taskId].push(line);
};

const setupProgressListener = () => {
  if (!window.electronAPI?.onUploadProgress) return;
  window.electronAPI.onUploadProgress((data) => {
    const taskId = currentUploadingTaskId.value;
    if (!taskId) return;
    const server = getServerById(data.serverId);
    const serverName = server?.name || `服务器 #${data.serverId}`;
    const time = new Date().toLocaleTimeString();

    if (data.error) {
      appendTaskLog(taskId, `[${time}] [${serverName}] 错误：${data.error}`);
    } else if (data.completed) {
      appendTaskLog(taskId, `[${time}] [${serverName}] 上传完成，成功 ${data.fileCount} 个文件，失败 ${data.failedCount} 个文件`);
    } else if (data.cancelled) {
      appendTaskLog(taskId, `[${time}] [${serverName}] 上传已取消`);
    } else if (typeof data.current === 'number' && data.fileName) {
      const pct = data.progress ?? (data.total > 0 ? Math.round((data.current / data.total) * 100) : 0);
      appendTaskLog(taskId, `[${time}] [${serverName}] ${data.fileName} (${data.current}/${data.total}，${pct}%)`);
    }
  });
};

const handleTaskUpload = async (task) => {
  const serverList = task.serverIds
    .map(id => getServerById(id))
    .filter(Boolean);

  if (serverList.length === 0) {
    ElMessage.warning('该任务没有有效服务器');
    return;
  }

  const names = serverList.map(s => s.name).join('、');
  try {
    await ElMessageBox.confirm(
      `确定要将任务「${task.name}」上传到以下服务器吗？\n\n${names}`,
      '确认上传',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'info' }
    );
  } catch {
    return;
  }

  task.uploading = true;
  currentUploadingTaskId.value = task.id;
  ensureTaskLog(task.id);
  const time = new Date().toLocaleTimeString();
  appendTaskLog(task.id, `[${time}] 开始上传任务，共 ${serverList.length} 个服务器`);

  let successCount = 0;
  let failCount = 0;

  for (const server of serverList) {
    if (!server.address || !server.ftpUsername || !server.serverPath || !server.localPath) {
      appendTaskLog(task.id, `[${new Date().toLocaleTimeString()}] [${server.name}] 配置不完整，已跳过`);
      failCount++;
      continue;
    }
    appendTaskLog(task.id, `[${new Date().toLocaleTimeString()}] [${server.name}] 开始上传...`);
    try {
      const config = getUploadConfig(server);
      const result = await window.electronAPI?.uploadFiles?.(config);
      if (result?.success || (result?.fileCount ?? 0) > 0) {
        successCount++;
      } else {
        failCount++;
        appendTaskLog(task.id, `[${new Date().toLocaleTimeString()}] [${server.name}] 失败：${result?.message || '未知错误'}`);
      }
    } catch (err) {
      failCount++;
      const errMsg = err.message || String(err);
      appendTaskLog(task.id, `[${new Date().toLocaleTimeString()}] [${server.name}] 异常：${errMsg}`);
      ElMessage.error(`${server.name} 上传失败: ${errMsg}`);
    }
  }

  currentUploadingTaskId.value = null;
  task.uploading = false;
  appendTaskLog(task.id, `[${new Date().toLocaleTimeString()}] 任务结束，成功 ${successCount} 个，失败 ${failCount} 个`);

  const msg = successCount > 0
    ? `上传完成：成功 ${successCount} 个${failCount > 0 ? `，失败 ${failCount} 个` : ''}`
    : '上传失败';
  ElMessage[failCount > 0 ? 'warning' : 'success'](msg);
};

onMounted(() => {
  loadServers();
  loadTasks();
  setupProgressListener();
});
</script>

<style scoped>
.task-management {
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}

.header-left {
  flex: 1;
}

.page-title {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
}

.page-desc {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.task-list {
  margin-top: 16px;
}

.task-card {
  margin-bottom: 16px;
}

.task-card-header {
  font-weight: 600;
}

.task-servers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  min-height: 28px;
}

.server-tag {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-servers {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.task-actions {
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.form-tip {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.log-subtitle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}

.log-content {
  background: var(--el-fill-color-dark);
  border-radius: 4px;
  padding: 12px;
  font-family: var(--el-font-family-mono);
  font-size: 12px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.log-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-line {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
