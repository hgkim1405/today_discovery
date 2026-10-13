<script setup lang="ts">
import { onMounted, ref } from "vue";
import AccountGate from "../components/AccountGate.vue";
import StateMessage from "../components/StateMessage.vue";
import { apiGet, ApiError } from "../api";

const error = ref("");
const loading = ref(true);
const count = ref(0);
onMounted(async () => {
  try {
    const result = await apiGet<{ items: unknown[] }>("/me/experiences");
    count.value = result.items.length;
  } catch (reason) {
    error.value =
      reason instanceof ApiError && reason.status === 401
        ? "AUTH_REQUIRED"
        : "도감을 불러오지 못했어요.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page-wrap simple-page collection-page">
    <header class="page-heading">
      <span class="eyebrow">YOUR EXPERIENCE BOOK</span>
      <h1>나의 경험 도감</h1>
      <p>해본 일을 기록하면 나만의 취향 지도가 만들어져요.</p>
    </header>
    <AccountGate
      v-if="error === 'AUTH_REQUIRED'"
      title="나만의 경험을 기록해 보세요"
      description="도감은 비공개로 시작하고, 공유 범위는 직접 선택할 수 있어요."
    />
    <StateMessage
      v-else-if="error"
      tone="error"
      title="도감을 불러오지 못했어요"
      :body="error"
    />
    <div v-else-if="loading" class="skeleton-card">
      <div></div>
      <span></span><span></span>
    </div>
    <StateMessage
      v-else-if="count === 0"
      tone="empty"
      title="첫 번째 기록을 기다리고 있어요"
      body="다녀온 경험을 남기고, 내 도감에서 오래 기억해 보세요."
    />
    <div v-else class="collection-summary">
      <strong>{{ count }}</strong
      ><span>개의 경험을 기록했어요</span>
    </div>
  </div>
</template>
