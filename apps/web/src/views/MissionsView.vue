<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import StateMessage from "../components/StateMessage.vue";
import { apiGet, ApiError } from "../api";

type Mission = { id: string; title: string; startsOn: string; endsOn: string };
const items = ref<Mission[]>([]);
const loading = ref(true);
const error = ref("");
onMounted(async () => {
  try {
    items.value = (await apiGet<{ items: Mission[] }>("/missions")).items;
  } catch (reason) {
    error.value =
      reason instanceof ApiError ? reason.message : "미션을 불러오지 못했어요.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page-wrap simple-page missions-page">
    <header class="page-heading">
      <span class="eyebrow">A LITTLE CHALLENGE</span>
      <h1>도전 미션</h1>
      <p>작은 목표 하나가 새로운 취향으로 이어질 수 있어요.</p>
    </header>
    <StateMessage
      v-if="error"
      tone="error"
      title="미션을 불러오지 못했어요"
      :body="error"
    />
    <div v-else-if="loading" class="skeleton-card">
      <div></div>
      <span></span><span></span>
    </div>
    <section
      v-else-if="items.length"
      class="mission-list"
      aria-label="진행 중인 미션"
    >
      <article v-for="mission in items" :key="mission.id" class="mission-card">
        <div class="mission-card__mark" aria-hidden="true">✳</div>
        <div>
          <span class="eyebrow">MONTHLY MISSION</span>
          <h2>{{ mission.title }}</h2>
          <p>{{ mission.startsOn }} – {{ mission.endsOn }}</p>
          <p class="program-card__note">
            경험 기록은 자기신고로 시작하며, 공식 출석 인증과 구분돼요.
          </p>
        </div>
        <RouterLink class="button button--outline" to="/collection"
          >내 기록 보기 <span aria-hidden="true">→</span></RouterLink
        >
      </article>
    </section>
    <StateMessage
      v-else
      tone="empty"
      title="진행 중인 미션이 없어요"
      body="새로운 미션이 열리면 이곳에 안내할게요."
    />
  </div>
</template>
