<template>
  <el-container class="app-layout">
    <el-aside width="200px" class="app-aside">
      <div class="logo">UpLink</div>
      <el-menu
        :default-active="activeMenu"
        class="app-menu"
        router
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/tasks">
          <el-icon><List /></el-icon>
          <span>任务管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { HomeFilled, List } from '@element-plus/icons-vue';

const route = useRoute();

const activeMenu = computed(() => {
  const path = route.path;
  if (path.startsWith('/tasks')) return '/tasks';
  return '/';
});
</script>

<style scoped>
.app-layout {
  height: 100%;
}

.app-aside {
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
}

.logo {
  height: 48px;
  line-height: 48px;
  padding: 0 16px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-color-primary);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.app-menu {
  border-right: none;
}

.app-main {
  padding: 0;
  overflow: auto;
  background: var(--el-bg-color-page);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
