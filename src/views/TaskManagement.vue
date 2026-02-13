<template>
  <div class="task-management">
    <div class="page-header">
      <h1 class="page-title">任务管理</h1>
      <p class="page-desc">在此管理上传任务、历史记录等</p>
    </div>
    <el-empty description="任务管理功能开发中，敬请期待" :image-size="120" />
  </div>
</template>

<script setup>
// 任务管理页面 - 预留扩展
</script>

<style scoped>
.task-management {
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
}

.page-desc {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}
</style>
