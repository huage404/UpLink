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
        </div>
        
        <div class="card-footer">
          <button class="upload-btn" @click="handleUpload(server)">
            <span class="upload-icon">↑</span>
            上传
          </button>
        </div>
      </div>
      
      <div v-if="servers.length === 0" class="empty-state">
        <p>暂无服务器配置</p>
        <button class="add-btn" @click="handleAddServer">添加第一个服务器</button>
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
              v-model="formData.name" 
              type="text" 
              placeholder="请输入服务器名字"
              required
            />
          </div>
          
          <div class="form-item">
            <label>服务器地址 <span class="required">*</span></label>
            <input 
              v-model="formData.address" 
              type="text" 
              placeholder="例如：192.168.1.100:21"
              required
            />
          </div>
          
          <div class="form-item">
            <label>FTP 账号名 <span class="required">*</span></label>
            <input 
              v-model="formData.ftpUsername" 
              type="text" 
              placeholder="请输入 FTP 账号名"
              required
            />
          </div>
          
          <div class="form-item">
            <label>FTP 密码 <span class="required">*</span></label>
            <input 
              v-model="formData.ftpPassword" 
              type="password" 
              placeholder="请输入 FTP 密码"
              required
            />
          </div>
          
          <div class="form-item">
            <label>服务器路径 <span class="required">*</span></label>
            <input 
              v-model="formData.serverPath" 
              type="text" 
              placeholder="例如：/var/www/html"
              required
            />
          </div>
          
          <div class="form-item">
            <label>本机路径 <span class="required">*</span></label>
            <div class="path-selector">
              <input 
                v-model="formData.localPath" 
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

// 表单数据
const formData = ref({
  name: '',
  address: '',
  ftpUsername: '',
  ftpPassword: '',
  serverPath: '',
  localPath: ''
})

// 从缓存加载数据
const loadServers = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      servers.value = JSON.parse(stored)
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
    localPath: ''
  }
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
    localPath: server.localPath
  }
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
    localPath: ''
  }
}

// 提交表单
const handleSubmit = () => {
  if (editingServer.value) {
    // 编辑模式
    const index = servers.value.findIndex(s => s.id === editingServer.value.id)
    if (index !== -1) {
      servers.value[index] = {
        ...editingServer.value,
        ...formData.value
      }
    }
  } else {
    // 新增模式
    const newServer = {
      id: Date.now(),
      ...formData.value
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
const handleUpload = (server) => {
  console.log('上传到服务器:', server)
  // TODO: 实现上传逻辑
  alert(`准备上传到服务器: ${server.name}`)
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
      alert('Electron API 未可用，请在 Electron 环境中使用')
    }
  } catch (error) {
    console.error('选择文件夹失败:', error)
    console.error('错误详情:', error.message, error.stack)
    alert(`选择文件夹失败: ${error.message || '未知错误'}`)
  }
}

// 组件挂载时加载数据
onMounted(() => {
  loadServers()
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
  margin-top: 1rem;
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

.upload-icon {
  font-size: 1.1rem;
  font-weight: bold;
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

.submit-btn:hover {
  background: #35a372;
}
</style>
