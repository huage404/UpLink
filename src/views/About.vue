<template>
  <div class="about">
    <h1>关于页面</h1>
    <p>这是一个使用 Vue Router 的 Electron 应用示例。</p>
    <nav>
      <router-link to="/">首页</router-link> |
      <router-link to="/about">关于</router-link>
    </nav>
  </div>
</template>

<script setup>
console.log('About page loaded');
</script>

<style scoped>
.about {
  text-align: center;
  padding: 2rem;
}

nav {
  margin-top: 2rem;
}

nav a {
  margin: 0 0.5rem;
  color: #42b983;
  text-decoration: none;
}

nav a.router-link-active {
  font-weight: bold;
  text-decoration: underline;
}
</style>
