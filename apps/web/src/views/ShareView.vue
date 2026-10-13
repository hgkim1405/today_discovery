<script setup lang="ts">
import { RouterLink } from "vue-router";
defineProps<{ token: string }>();
</script>

<template>
  <div class="page-wrap simple-page">
    <header class="page-heading">
      <span class="eyebrow">A SHARED DISCOVERY</span>
      <h1>함께 보는 경험</h1>
      <p>공유된 활동과 도감 기록을 확인하는 페이지예요.</p>
    </header>
    <section class="state-message state-message--info" role="status">
      <div class="state-message__symbol" aria-hidden="true">i</div>
      <div>
        <h2>아직 공유 내용을 확인할 수 없어요</h2>
        <p>
          공유 링크 기능은 계정과 공개 범위 확인을 연결한 뒤 제공됩니다. 링크
          토큰은 화면에 다시 노출하지 않습니다.
        </p>
        <RouterLink class="button button--outline" to="/discover"
          >공개 활동 둘러보기</RouterLink
        >
      </div>
    </section>
  </div>
</template>
