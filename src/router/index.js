import { createRouter, createWebHashHistory } from 'vue-router';
import Layout from '../layouts/Layout.vue';
import Home from '../views/Home.vue';
import TaskManagement from '../views/TaskManagement.vue';

const routes = [
  {
    path: '/',
    component: Layout,
    children: [
      {
        path: '',
        name: 'Home',
        component: Home,
        meta: { title: '首页' }
      },
      {
        path: 'tasks',
        name: 'TaskManagement',
        component: TaskManagement,
        meta: { title: '任务管理' }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
