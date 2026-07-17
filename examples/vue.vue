<script setup>
import { onMounted, onUnmounted } from 'vue';
import AIEditor from 'visual-ai-editor';
import 'visual-ai-editor/dist/ai-editor.css';

onMounted(() => {
  AIEditor.init({ apiBase: '/api' });
});

onUnmounted(() => {
  AIEditor.destroy();
});
</script>

<template>
  <div class="hero">
    <h1>Meu Site</h1>
    <p>Clique nos elementos para editar com IA.</p>
  </div>
</template>
