<template>
  <div class="home">
    <div class="header">
      <h1 class="page-title">服务器列表</h1>
      <div class="header-actions">
        <el-button @click="handleOpenImport">导入</el-button>
        <el-button type="primary" plain @click="handleExport" :disabled="servers.length === 0">导出</el-button>
        <el-button type="primary" @click="handleAddServer">
          <el-icon><Plus /></el-icon>
          添加服务器
        </el-button>
      </div>
    </div>

    <div v-for="group in serversGroupedByHost" :key="group.host" class="server-group">
      <div class="server-group-title">
        <span class="server-group-host">{{ group.host }}</span>
        <span class="server-group-count">{{ group.servers.length }} 个配置</span>
      </div>
      <el-row :gutter="16" class="server-list">
        <el-col v-for="server in group.servers" :key="server.id" :xs="24" :sm="12" :md="8" :lg="8">
          <el-card class="server-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <div class="card-header-main">
                  <span class="server-name">{{ server.name }}</span>
                  <span class="card-mode-tag">{{ connectionModeLabel(server.connectionMode) }}</span>
                </div>
                <div class="card-actions">
                  <el-button size="small" link type="primary" @click="handleCopyConfig(server)" title="复制配置">
                    <el-icon><DocumentCopy /></el-icon>
                  </el-button>
                  <el-button size="small" link @click="handleEdit(server)">编辑</el-button>
                  <el-button size="small" link type="danger" @click="handleDelete(server.id)">删除</el-button>
                </div>
              </div>
            </template>

            <div class="card-content">
              <div class="card-info-list">
                <div class="card-info-row">
                  <span class="card-info-label">服务器地址</span>
                  <span class="card-info-value" :title="server.address">{{ server.address }}</span>
                </div>
                <div class="card-info-row">
                  <span class="card-info-label">FTP 账号</span>
                  <span class="card-info-value">{{ server.ftpUsername }}</span>
                </div>
                <div class="card-info-row">
                  <span class="card-info-label">服务器路径</span>
                  <span class="card-info-value card-info-value-path" :title="server.serverPath">{{ server.serverPath }}</span>
                </div>
                <div class="card-info-row">
                  <span class="card-info-label">本机路径</span>
                  <span class="card-info-value card-info-value-path" :title="server.localPath">{{ server.localPath }}</span>
                </div>
                <div v-if="server.filterRule" class="card-info-row">
                  <span class="card-info-label">过滤规则</span>
                  <span class="card-info-value">{{ server.filterRule }}</span>
                </div>
              </div>
            </div>

            <div class="card-footer">
              <div class="upload-actions">
                <template v-if="!server.uploading">
                  <el-button class="btn-upload" type="primary" @click="handleUpload(server)">
                    <el-icon><Upload /></el-icon>
                    上传
                  </el-button>
                </template>
                <template v-else>
                  <el-button class="btn-cancel" type="danger" @click="handleCancelUpload(server)">
                    <el-icon><Close /></el-icon>
                    取消
                  </el-button>
                  <el-button class="btn-log" @click="handleViewLog(server)">查看日志</el-button>
                </template>
              </div>

              <el-progress
                v-if="server.uploadProgress"
                :percentage="server.uploadProgress.progress"
                :stroke-width="6"
                class="card-progress"
              />
              <p v-if="server.uploadProgress?.fileName" class="current-file">正在上传: {{ server.uploadProgress.fileName }}</p>

              <el-alert
                v-if="server.uploadStatus"
                :title="server.uploadStatus.message"
                :type="server.uploadStatus.type"
                show-icon
                :closable="false"
                class="card-status-alert"
              />
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-empty v-if="servers.length === 0" description="暂无服务器配置" class="empty-state">
      <el-button type="primary" @click="handleAddServer">添加第一个服务器</el-button>
    </el-empty>

    <!-- 日志抽屉 -->
    <el-drawer
      v-model="showLogPanel"
      title="上传日志"
      direction="rtl"
      size="420px"
      :with-header="true"
    >
      <template v-if="currentLogServer">
        <div class="log-subtitle">{{ currentLogServer.name }}</div>
        <div class="log-content">
          <div v-if="serverLogs[currentLogServer.id]?.length" class="log-lines">
            <div v-for="(line, index) in serverLogs[currentLogServer.id]" :key="index" class="log-line">{{ line }}</div>
          </div>
          <el-empty v-else description="暂无日志" :image-size="60" />
        </div>
      </template>
    </el-drawer>

    <!-- 导入弹窗 -->
    <el-dialog
      v-model="showImportDialog"
      title="导入服务器配置"
      width="520px"
      top="8vh"
      destroy-on-close
      @close="handleCloseImportDialog"
    >
      <el-tabs v-model="importTab">
        <el-tab-pane label="从文件导入" name="file">
          <input
            ref="importFileInput"
            type="file"
            accept=".json,application/json"
            style="display: none"
            @change="handleImportFileSelect"
          />
          <el-button type="primary" @click="triggerImportFile">选择 JSON 文件</el-button>
          <p class="import-hint">选择包含服务器配置的 .json 文件（可为单个配置对象或配置数组）</p>
        </el-tab-pane>
        <el-tab-pane label="粘贴 JSON" name="paste">
          <el-input
            v-model="importJsonText"
            type="textarea"
            :rows="10"
            placeholder='粘贴 JSON，例如：[{"name":"服务器名","address":"host:21",...}] 或单个对象 {"name":"..."}'
            class="import-textarea"
          />
          <p class="import-hint">支持单个配置对象或配置数组</p>
        </el-tab-pane>
      </el-tabs>
      <el-alert v-if="importError" :title="importError" type="error" show-icon style="margin-top: 12px" />
      <template #footer>
        <el-button @click="handleCloseImportDialog">取消</el-button>
        <el-button v-if="importTab === 'paste'" type="primary" @click="handleConfirmImport">确认导入</el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑服务器弹窗 -->
    <el-dialog
      v-model="showDialog"
      :title="editingServer ? '编辑服务器' : '添加服务器'"
      width="560px"
      top="8vh"
      destroy-on-close
      @close="handleCloseDialog"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px" label-position="top">
        <el-form-item label="服务器名字" prop="name" required>
          <el-input v-model.trim="formData.name" placeholder="请输入服务器名字" />
        </el-form-item>
        <el-form-item label="服务器地址" prop="address" required>
          <el-input v-model.trim="formData.address" placeholder="例如：192.168.1.100 或 192.168.1.100:21" />
          <div class="form-tip">可带端口（如 :21、:22）；不填端口时将按连接模式使用默认端口。</div>
        </el-form-item>
        <el-form-item label="连接模式" prop="connectionMode" required>
          <el-select v-model="formData.connectionMode" style="width: 100%">
            <el-option value="ftp" label="普通 FTP（不加密）" />
            <el-option value="ftps-explicit" label="显式 FTPS（FTPES，通常端口 21）" />
            <el-option value="ftps-implicit" label="隐式 FTPS（通常端口 990）" />
            <el-option value="sftp" label="SFTP（基于 SSH，通常端口 22）" />
          </el-select>
        </el-form-item>
        <el-form-item label="FTP 账号名" prop="ftpUsername" required>
          <el-input v-model.trim="formData.ftpUsername" placeholder="请输入 FTP 账号名" />
        </el-form-item>
        <el-form-item label="FTP 密码" prop="ftpPassword" required>
          <el-input
            v-model.trim="formData.ftpPassword"
            type="password"
            placeholder="请输入 FTP 密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="服务器路径" prop="serverPath" required>
          <el-input v-model.trim="formData.serverPath" placeholder="例如：/var/www/html" />
        </el-form-item>
        <el-form-item label="本机路径" prop="localPath" required>
          <div class="path-selector">
            <el-input v-model.trim="formData.localPath" placeholder="请选择文件夹" readonly />
            <el-button type="primary" @click="handleSelectFolder">选择文件夹</el-button>
          </div>
        </el-form-item>
        <el-form-item label="文件过滤规则（可选）">
          <div class="filter-rules-editor">
            <div v-if="formData.filterRuleItems.length" class="filter-tags">
              <el-tag
                v-for="(item, index) in formData.filterRuleItems"
                :key="index"
                closable
                size="small"
                class="filter-tag"
                @close="removeFilterRule(index)"
              >
                {{ item }}
              </el-tag>
            </div>
            <el-input
              ref="filterRuleInputRef"
              v-model="filterRuleInput"
              placeholder="输入文件名、目录名或正则（如 node_modules、*.log），回车添加"
              class="filter-rule-input"
              @keyup.enter="addFilterRule"
            />
          </div>
          <div class="form-tip">匹配到的文件或文件夹将被跳过（不上传）。每输入一条规则后按回车添加。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleCloseDialog">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload, Close, DocumentCopy } from '@element-plus/icons-vue'

const STORAGE_KEY = 'uplink_servers'

const servers = ref([])
const filterRuleInput = ref('')
const filterRuleInputRef = ref(null)
const showDialog = ref(false)
const editingServer = ref(null)
const showImportDialog = ref(false)
const importTab = ref('file')
const importJsonText = ref('')
const importError = ref('')
const importFileInput = ref(null)
const showLogPanel = ref(false)
const currentLogServer = ref(null)
const serverLogs = ref({})
const formData = ref({
  name: '',
  address: '',
  ftpUsername: '',
  ftpPassword: '',
  serverPath: '',
  localPath: '',
  connectionMode: 'ftp',
  filterRuleItems: []
})

const formRef = ref(null)
const formRules = {
  name: [{ required: true, message: '请输入服务器名字', trigger: 'blur' }],
  address: [{ required: true, message: '请输入服务器地址', trigger: 'blur' }],
  connectionMode: [{ required: true, message: '请选择连接模式', trigger: 'change' }],
  ftpUsername: [{ required: true, message: '请输入 FTP 账号名', trigger: 'blur' }],
  ftpPassword: [{ required: true, message: '请输入 FTP 密码', trigger: 'blur' }],
  serverPath: [{ required: true, message: '请输入服务器路径', trigger: 'blur' }],
  localPath: [{ required: true, message: '请选择本机路径', trigger: 'change' }]
}

const connectionModeLabels = {
  ftp: 'FTP',
  'ftps-explicit': 'FTPS',
  'ftps-implicit': 'FTPS',
  sftp: 'SFTP'
}
const connectionModeLabel = (mode) => connectionModeLabels[mode] || mode || 'FTP'

/** 从 address（如 192.168.1.100:21）中提取主机部分，用于分组 */
const getAddressHost = (address) => {
  if (!address || typeof address !== 'string') return ''
  const idx = address.indexOf(':')
  return idx === -1 ? address.trim() : address.slice(0, idx).trim()
}

/** 按服务器地址（IP/主机）分组，便于同一台机器多个配置归类展示 */
const serversGroupedByHost = computed(() => {
  const map = new Map()
  for (const server of servers.value) {
    const host = getAddressHost(server.address) || '未指定地址'
    if (!map.has(host)) map.set(host, [])
    map.get(host).push(server)
  }
  return Array.from(map.entries()).map(([host, list]) => ({ host, servers: list }))
})

const ensureServerLog = (serverId) => {
  if (!serverLogs.value[serverId]) serverLogs.value[serverId] = []
}

const getServerConfig = (server) => ({
  name: server.name,
  address: server.address,
  connectionMode: server.connectionMode || 'ftp',
  ftpUsername: server.ftpUsername,
  ftpPassword: server.ftpPassword || '',
  serverPath: server.serverPath,
  localPath: server.localPath,
  filterRule: server.filterRule || ''
})

/** 判断两份配置是否完全相同（用于去重） */
const isConfigEqual = (a, b) => {
  const keys = ['name', 'address', 'connectionMode', 'ftpUsername', 'ftpPassword', 'serverPath', 'localPath', 'filterRule']
  return keys.every(k => (a[k] || '') === (b[k] || ''))
}

/** 判断配置是否与现有服务器重复 */
const isDuplicateConfig = (config) => {
  return servers.value.some(s => isConfigEqual(getServerConfig(s), config))
}

const handleCopyConfig = async (server) => {
  const config = getServerConfig(server)
  const json = JSON.stringify(config, null, 2)
  try {
    await navigator.clipboard.writeText(json)
    ElMessage.success('已复制到剪贴板')
  } catch (err) {
    ElMessage.error('复制失败，请手动复制')
  }
}

const handleOpenImport = () => {
  importTab.value = 'file'
  importJsonText.value = ''
  importError.value = ''
  showImportDialog.value = true
}

const handleCloseImportDialog = () => {
  showImportDialog.value = false
  importError.value = ''
}

const triggerImportFile = () => {
  importError.value = ''
  importFileInput.value?.click()
}

const handleImportFileSelect = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  importError.value = ''
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const text = ev.target?.result
      if (!text) throw new Error('文件为空')
      const data = JSON.parse(text)
      addServersFromImportedData(data)
    } catch (err) {
      importError.value = '解析失败：' + (err.message || String(err))
    }
    e.target.value = ''
  }
  reader.readAsText(file, 'utf-8')
}

const addServersFromImportedData = (data) => {
  const list = Array.isArray(data) ? data : [data]
  const baseId = Date.now()
  const toAdd = []
  let duplicateCount = 0
  for (let index = 0; index < list.length; index++) {
    const item = list[index]
    const config = {
      name: item.name || '未命名',
      address: item.address || '',
      connectionMode: item.connectionMode || 'ftp',
      ftpUsername: item.ftpUsername || '',
      ftpPassword: item.ftpPassword || '',
      serverPath: item.serverPath || '',
      localPath: item.localPath || '',
      filterRule: item.filterRule || ''
    }
    if (isDuplicateConfig(config)) {
      duplicateCount++
      continue
    }
    toAdd.push({
      id: baseId + index,
      ...config,
      uploading: false,
      uploadProgress: null,
      uploadStatus: null
    })
  }
  if (duplicateCount > 0) {
    ElMessage.warning(`已跳过 ${duplicateCount} 条重复配置（与现有服务器完全一致）`)
  }
  if (toAdd.length > 0) {
    servers.value.push(...toAdd)
    saveServers()
    ElMessage.success(`成功导入 ${toAdd.length} 个服务器配置`)
  } else if (duplicateCount === 0) {
    ElMessage.info('没有可导入的配置')
  }
  handleCloseImportDialog()
}

const handleConfirmImport = () => {
  if (importTab.value !== 'paste') return
  importError.value = ''
  const text = importJsonText.value.trim()
  if (!text) {
    importError.value = '请粘贴 JSON 内容'
    return
  }
  try {
    const data = JSON.parse(text)
    addServersFromImportedData(data)
  } catch (err) {
    importError.value = 'JSON 格式错误：' + (err.message || String(err))
  }
}

const handleExport = async () => {
  const list = servers.value.map(s => getServerConfig(s))
  const jsonString = JSON.stringify(list, null, 2)
  try {
    if (window.electronAPI?.exportServersToFile) {
      const result = await window.electronAPI.exportServersToFile(jsonString)
      if (result?.success) {
        ElMessage.success('导出成功：' + result.path)
      }
    } else {
      const blob = new Blob([jsonString], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'uplink-servers.json'
      a.click()
      URL.revokeObjectURL(a.href)
      ElMessage.success('已下载 uplink-servers.json')
    }
  } catch (err) {
    ElMessage.error('导出失败：' + (err.message || String(err)))
  }
}

const loadServers = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const loadedServers = JSON.parse(stored)
      servers.value = loadedServers.map(server => ({
        ...server,
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

const saveServers = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servers.value))
  } catch (error) {
    console.error('保存服务器数据失败:', error)
  }
}

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
    filterRuleItems: []
  }
  showDialog.value = true
}

const handleEdit = (server) => {
  editingServer.value = server
  const items = (server.filterRule || '').trim().split(/\|/).filter(Boolean)
  formData.value = {
    name: server.name,
    address: server.address,
    ftpUsername: server.ftpUsername,
    ftpPassword: server.ftpPassword || '',
    serverPath: server.serverPath,
    localPath: server.localPath,
    connectionMode: server.connectionMode || 'ftp',
    filterRuleItems: items
  }
  showDialog.value = true
}

const handleCloseDialog = () => {
  showDialog.value = false
  editingServer.value = null
  formRef.value?.clearValidate()
  formData.value = {
    name: '',
    address: '',
    ftpUsername: '',
    ftpPassword: '',
    serverPath: '',
    localPath: '',
    connectionMode: 'ftp',
    filterRuleItems: []
  }
}

/** 单条规则转成正则片段：支持 *.ext 简单通配 */
const ruleItemToPattern = (item) => {
  const s = (item || '').trim()
  if (!s) return ''
  if (/^\*\.([a-zA-Z0-9_.-]+)$/.test(s)) return s.slice(2).replace(/\./g, '\\.') + '$'
  return s
}

/** 由已添加的规则列表合并为最终 filterRule 字符串 */
const buildFilterRule = () => {
  const parts = formData.value.filterRuleItems
    .map(ruleItemToPattern)
    .filter(Boolean)
  return parts.join('|') || ''
}

const addFilterRule = () => {
  const val = filterRuleInput.value.trim()
  if (!val) return
  if (formData.value.filterRuleItems.includes(val)) {
    ElMessage.warning('该规则已存在')
    return
  }
  formData.value.filterRuleItems.push(val)
  filterRuleInput.value = ''
  filterRuleInputRef.value?.focus()
}

const removeFilterRule = (index) => {
  formData.value.filterRuleItems.splice(index, 1)
}

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const trimmed = {
    ...formData.value,
    name: formData.value.name.trim(),
    address: formData.value.address.trim(),
    ftpUsername: formData.value.ftpUsername.trim(),
    ftpPassword: formData.value.ftpPassword.trim(),
    serverPath: formData.value.serverPath.trim(),
    localPath: formData.value.localPath.trim(),
    filterRule: buildFilterRule()
  }
  delete trimmed.filterRuleItems
  if (editingServer.value) {
    const index = servers.value.findIndex(s => s.id === editingServer.value.id)
    if (index !== -1) {
      servers.value[index] = { ...editingServer.value, ...trimmed }
    }
  } else {
    if (isDuplicateConfig(trimmed)) {
      ElMessage.warning('该配置与已有服务器完全一致，无需重复添加')
      return
    }
    servers.value.push({
      id: Date.now(),
      ...trimmed,
      uploading: false,
      uploadProgress: null,
      uploadStatus: null
    })
  }
  saveServers()
  handleCloseDialog()
}

const handleDelete = (id) => {
  ElMessageBox.confirm('确定要删除这个服务器配置吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    servers.value = servers.value.filter(s => s.id !== id)
    saveServers()
    ElMessage.success('已删除')
  }).catch(() => {})
}

const handleUpload = async (server) => {
  if (!server.address || !server.ftpUsername || !server.ftpPassword || !server.serverPath || !server.localPath) {
    ElMessage.warning('请完善服务器配置')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定要上传本地文件夹 "${server.localPath}" 到服务器 "${server.name}" 的 "${server.serverPath}" 路径吗？`,
      '确认上传',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'info' }
    )
  } catch {
    return
  }

  server.uploading = true
  server.uploadProgress = null
  server.uploadStatus = null

  try {
    if (!window.electronAPI?.uploadFiles) {
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
    if (result.fileCount > 0) {
      server.uploadStatus = {
        type: result.failedCount > 0 ? 'warning' : 'success',
        message: result.message
      }
    } else {
      server.uploadStatus = {
        type: result.cancelled ? 'warning' : 'error',
        message: result.cancelled ? '上传已取消' : (result.message || '上传失败')
      }
    }
  } catch (error) {
    const errorMessage = error.message || '上传过程中发生未知错误'
    const isCancelled = errorMessage.includes('上传已取消') || errorMessage === 'cancelled'
    server.uploadStatus = {
      type: isCancelled ? 'warning' : 'error',
      message: isCancelled ? '上传已取消' : errorMessage
    }
  } finally {
    server.uploading = false
  }
}

const handleCancelUpload = async (server) => {
  try {
    await ElMessageBox.confirm('确定要取消上传吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    if (window.electronAPI?.cancelUpload) {
      await window.electronAPI.cancelUpload(server.id)
      server.uploading = false
      server.uploadProgress = null
      server.uploadStatus = { type: 'warning', message: '上传已取消' }
    }
  } catch (error) {
    console.error('取消上传失败:', error)
  }
}

const handleViewLog = (server) => {
  currentLogServer.value = server
  ensureServerLog(server.id)
  showLogPanel.value = true
}

const handleSelectFolder = async () => {
  try {
    if (window.electronAPI?.selectFolder) {
      const path = await window.electronAPI.selectFolder()
      if (path) formData.value.localPath = path
    }
  } catch (error) {
    console.error('选择文件夹失败:', error)
    ElMessage.error('选择文件夹失败')
  }
}

const setupProgressListener = () => {
  if (!window.electronAPI?.onUploadProgress) return
  window.electronAPI.onUploadProgress((data) => {
    const server = servers.value.find(s => s.id === data.serverId)
    if (!server) return
    ensureServerLog(data.serverId)
    const logs = serverLogs.value[data.serverId]
    const time = new Date().toLocaleTimeString()

    if (data.error) {
      server.uploadStatus = { type: 'error', message: `上传失败: ${data.error}` }
      server.uploading = false
      logs.push(`[${time}] 错误：${data.error}`)
    } else if (data.completed) {
      server.uploading = false
      server.uploadProgress = null
      logs.push(`[${time}] 上传完成，成功 ${data.fileCount} 个文件，失败 ${data.failedCount} 个文件`)
    } else if (data.cancelled) {
      server.uploading = false
      server.uploadProgress = null
      server.uploadStatus = { type: 'warning', message: '上传已取消' }
      logs.push(`[${time}] 上传已取消`)
    } else if (typeof data.current === 'number' && typeof data.total === 'number') {
      server.uploadProgress = {
        current: data.current || 0,
        total: data.total || 0,
        progress: data.progress || 0,
        fileName: data.fileName || ''
      }
      if (data.fileName) {
        logs.push(`[${time}] 上传 ${data.fileName} (${server.uploadProgress.current}/${server.uploadProgress.total}，${server.uploadProgress.progress}%)`)
      }
    }
  })
}

onMounted(() => {
  loadServers()
  setupProgressListener()
})
</script>

<style scoped>
.home {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100%;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 仅在小窗时紧凑：约 900px 以下才生效 */
@media (max-width: 900px) {
  .home {
    padding: 16px;
  }
  .header {
    margin-bottom: 16px;
    gap: 8px;
  }
  .page-title {
    font-size: 1.25rem;
  }
  .server-group-title {
    margin-bottom: 12px;
    padding-bottom: 8px;
  }
  .server-card :deep(.el-card__header) {
    padding: 12px 14px;
  }
  .server-card :deep(.el-card__body) {
    padding: 14px;
  }
  .server-name {
    font-size: 0.95rem;
  }
  .card-info-row {
    font-size: 12px;
  }
  .card-info-label {
    width: 72px;
    font-size: 11px;
  }
  .card-info-value-path {
    font-size: 11px;
  }
  .card-content {
    margin-bottom: 12px;
  }
  .card-footer {
    padding-top: 12px;
  }
  .card-footer .el-button {
    padding: 6px 12px;
    font-size: 13px;
  }
  .card-progress {
    margin-top: 10px;
  }
  .current-file {
    margin-top: 6px;
    font-size: 11px;
  }
  .card-status-alert {
    margin-top: 10px;
  }
}

@media (max-width: 768px) {
  .home {
    padding: 12px;
  }
  .header {
    margin-bottom: 12px;
    flex-direction: column;
    align-items: flex-start;
  }
  .header-actions {
    width: 100%;
  }
  .page-title {
    font-size: 1.1rem;
  }
  .server-card :deep(.el-card__header) {
    padding: 10px 12px;
  }
  .server-card :deep(.el-card__body) {
    padding: 12px;
  }
  .server-name {
    font-size: 0.9rem;
  }
  .card-info-label {
    width: 68px;
    font-size: 11px;
  }
  .card-info-value-path {
    font-size: 11px;
  }
  .card-footer {
    padding-top: 10px;
  }
  .card-footer .el-button {
    padding: 5px 10px;
    font-size: 12px;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.server-group {
  margin-bottom: 28px;
}

.server-group:last-child {
  margin-bottom: 24px;
}

.server-group-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
  padding: 6px 0 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.server-group-host {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--el-text-color-primary);
  letter-spacing: 0.02em;
}

.server-group-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.server-list {
  margin-bottom: 0;
}

/* ---------- 卡片整体 ---------- */
.server-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.server-card:hover {
  border-color: var(--el-border-color);
}

.server-card :deep(.el-card__header) {
  padding: 14px 16px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.server-card :deep(.el-card__body) {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.card-header-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.server-name {
  font-weight: 600;
  font-size: 1rem;
  color: var(--el-text-color-primary);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-mode-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

/* ---------- 信息列表（替代 descriptions） ---------- */
.card-content {
  margin-bottom: 16px;
  flex: 1;
  min-height: 0;
}

.card-info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-info-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  line-height: 1.4;
}

.card-info-label {
  flex-shrink: 0;
  width: 78px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.card-info-value {
  flex: 1;
  min-width: 0;
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.card-info-value-path {
  font-family: var(--el-font-family-mono);
  font-size: 12px;
}

/* ---------- 底部操作与状态 ---------- */
.card-footer {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.upload-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.upload-actions .btn-upload,
.upload-actions .btn-cancel {
  flex: 1;
  min-width: 0;
}

.upload-actions .btn-log {
  flex-shrink: 0;
}

.card-progress {
  margin-top: 12px;
}

.current-file {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-status-alert {
  margin-top: 12px;
}

.empty-state {
  padding: 48px 0;
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

.import-hint {
  margin-top: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.import-textarea {
  font-family: var(--el-font-family-mono);
}

.path-selector {
  display: flex;
  gap: 8px;
  width: 100%;
}

.path-selector .el-input {
  flex: 1;
}

.filter-rules-editor {
  width: 100%;
}
.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-bottom: 8px;
}
.filter-tag {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.filter-rule-input {
  width: 100%;
}
.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
