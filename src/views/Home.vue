<template>
  <div class="home">
    <h1>💖 Hello World!</h1>
    <p>Welcome to your Electron application.</p>
    <nav>
      <router-link to="/">首页</router-link> |
      <router-link to="/about">关于</router-link>
    </nav>
  </div>
</template>

<script setup>
console.log('👋 This message is being logged by "Home.vue"');
</script>

<style scoped>
.home {
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
