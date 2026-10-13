<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    body: string;
    tone?: "empty" | "error" | "info";
  }>(),
  { tone: "info" },
);
</script>

<template>
  <section
    class="state-message"
    :class="`state-message--${tone}`"
    role="status"
  >
    <div class="state-message__symbol" aria-hidden="true">
      {{ tone === "error" ? "!" : tone === "empty" ? "◇" : "i" }}
    </div>
    <div>
      <h2>{{ title }}</h2>
      <p>{{ body }}</p>
      <slot />
    </div>
  </section>
</template>
