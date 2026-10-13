<script setup lang="ts">
import { onMounted, ref } from "vue";
import ActivityCard from "../components/ActivityCard.vue";
import AccountGate from "../components/AccountGate.vue";
import StateMessage from "../components/StateMessage.vue";
import { apiGet, ApiError, type Activity } from "../api";

const items = ref<Activity[]>([]);
const loading = ref(true);
const error = ref("");
onMounted(async () => {
  try {
    const result = await apiGet<{ items: Activity[] }>("/me/favorites");
    items.value = result.items;
  } catch (reason) {
    error.value =
      reason instanceof ApiError && reason.status === 401
        ? "AUTH_REQUIRED"
        : "관심 목록을 불러오지 못했어요.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page-wrap simple-page">
    <header class="page-heading">
      <span class="eyebrow">SAVED FOR LATER</span>
      <h1>관심 목록</h1>
      <p>다시 보고 싶은 활동과 모집 상태 변화를 모아두는 곳이에요.</p>
    </header>
    <AccountGate
      v-if="error === 'AUTH_REQUIRED'"
      title="로그인 후 관심 활동을 모아볼 수 있어요"
      description="마음에 드는 활동을 저장하고 일정과 신청 상태 변경을 확인할 수 있어요."
    />
    <StateMessage
      v-else-if="error"
      tone="error"
      title="관심 목록을 불러오지 못했어요"
      :body="error"
    />
    <div v-else-if="loading" class="skeleton-card">
      <div></div>
      <span></span><span></span>
    </div>
    <StateMessage
      v-else-if="items.length === 0"
      tone="empty"
      title="아직 저장한 활동이 없어요"
      body="관심 있는 활동을 찾으면 여기에서 다시 확인할 수 있어요."
    />
    <div v-else class="activity-grid">
      <ActivityCard
        v-for="activity in items"
        :key="activity.id"
        :activity="activity"
      />
    </div>
  </div>
</template>
