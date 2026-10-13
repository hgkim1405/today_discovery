<script setup lang="ts">
import { onMounted, ref } from "vue";
import AccountGate from "../components/AccountGate.vue";
import StateMessage from "../components/StateMessage.vue";
import { apiGet, ApiError } from "../api";

const error = ref("");
const loading = ref(true);
onMounted(async () => {
  try {
    await apiGet("/me/preferences");
  } catch (reason) {
    error.value =
      reason instanceof ApiError && reason.status === 401
        ? "AUTH_REQUIRED"
        : "설정을 불러오지 못했어요.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page-wrap simple-page">
    <header class="page-heading">
      <span class="eyebrow">YOUR SETTINGS</span>
      <h1>설정</h1>
      <p>지역과 관심 분야, 알림 수신 동의, 개인정보를 관리해요.</p>
    </header>
    <AccountGate
      v-if="error === 'AUTH_REQUIRED'"
      title="내 설정을 안전하게 관리해요"
      description="계정 연결 후 관심 지역과 알림, 개인정보 요청을 관리할 수 있어요."
    />
    <StateMessage
      v-else-if="error"
      tone="error"
      title="설정을 불러오지 못했어요"
      :body="error"
    />
    <div v-else-if="loading" class="skeleton-card">
      <div></div>
      <span></span><span></span>
    </div>
  </div>
</template>
