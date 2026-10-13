<script setup lang="ts">
import { RouterLink } from "vue-router";
defineProps<{ title: string; description: string }>();
</script>

<template>
  <section class="account-gate">
    <div class="account-gate__icon" aria-hidden="true">♡</div>
    <span class="eyebrow">YOUR PRIVATE SPACE</span>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <p class="account-gate__note">
      로그인 제공자 연결 전이라 계정 기능을 사용할 수 없어요. 공개 활동 탐색은
      계속 이용할 수 있어요.
    </p>
    <RouterLink class="button button--outline" to="/discover"
      >활동 먼저 둘러보기 <span aria-hidden="true">→</span></RouterLink
    >
  </section>
</template>
