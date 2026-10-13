<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { RouterLink } from "vue-router";
import ActivityCard from "../components/ActivityCard.vue";
import StateMessage from "../components/StateMessage.vue";
import { ApiError, searchActivities, type Activity } from "../api";
import { nextWeekend } from "../date";

const weekend = nextWeekend();
const activities = ref<Activity[]>([]);
const loading = ref(true);
const error = ref("");
const researchSampleMode = ref(false);
const controller = new AbortController();

onMounted(async () => {
  try {
    const page = await searchActivities(
      {
        from: weekend.from,
        to: weekend.to,
        maxConfirmedPriceKrw: 10_000,
        limit: 6,
      },
      controller.signal,
    );
    activities.value = page.items;
    researchSampleMode.value = Boolean(page.researchSampleMode);
  } catch (reason) {
    error.value =
      reason instanceof ApiError
        ? reason.message
        : "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.";
  } finally {
    loading.value = false;
  }
});
onUnmounted(() => controller.abort());
</script>

<template>
  <div class="home-page page-wrap">
    <section class="hero">
      <div class="hero__copy">
        <span class="eyebrow"
          ><span class="eyebrow__dot"></span> 일상의 바깥에서 만나는 새로운
          나</span
        >
        <h1>이번 주말엔<br /><em>무엇을 해볼까요?</em></h1>
        <p>내가 사는 곳 가까이, 지금 참여할 수 있는 경험을 찾아요.</p>
        <div class="hero__filters" aria-label="추천 검색 조건">
          <span>이번 주말</span><span>1만원 이하</span><span>확인된 정보</span>
        </div>
        <RouterLink
          class="button button--primary"
          :to="{
            path: '/discover',
            query: {
              from: weekend.from,
              to: weekend.to,
              maxConfirmedPriceKrw: '10000',
            },
          }"
        >
          경험 찾아보기 <span aria-hidden="true">→</span>
        </RouterLink>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="hero-art__sun"></div>
        <div class="hero-art__orbit hero-art__orbit--one"></div>
        <div class="hero-art__orbit hero-art__orbit--two"></div>
        <div class="hero-art__card hero-art__card--one">
          <span>이번 주말</span><b>발견의<br />기록</b><i>✳</i>
        </div>
        <div class="hero-art__card hero-art__card--two">
          <span>나의 취향</span><b>새로운<br />경험</b><i>↗</i>
        </div>
        <div class="hero-art__caption">새로운 하루가<br />기다리고 있어요</div>
      </div>
    </section>

    <section class="trust-strip" aria-label="데이터 안내">
      <span class="trust-strip__icon" aria-hidden="true">✓</span>
      <p>
        공식 원문과 확인 상태를 함께 보여드려요. 현재 공개 검색에는 검수와 이용
        승인이 끝난 활동만 표시됩니다.
      </p>
      <span v-if="researchSampleMode" class="badge badge--research"
        >연구 표본 모드</span
      >
    </section>

    <section class="section-block">
      <div class="section-heading">
        <div>
          <span class="eyebrow">WEEKEND PICKS</span>
          <h2>이번 주말, 가볍게 시작하기</h2>
          <p>{{ weekend.from }} – {{ weekend.to }} · 확인된 가격 1만원 이하</p>
        </div>
        <RouterLink
          class="text-link"
          :to="{
            path: '/discover',
            query: {
              from: weekend.from,
              to: weekend.to,
              maxConfirmedPriceKrw: '10000',
            },
          }"
          >모두 보기 <span aria-hidden="true">→</span></RouterLink
        >
      </div>
      <div v-if="loading" class="activity-grid" aria-label="활동을 불러오는 중">
        <div v-for="number in 3" :key="number" class="skeleton-card">
          <div></div>
          <span></span><span></span>
        </div>
      </div>
      <StateMessage
        v-else-if="error"
        tone="error"
        title="활동을 불러오지 못했어요"
        :body="error"
      >
        <RouterLink class="text-link" to="/discover"
          >검색 화면으로 이동 →</RouterLink
        >
      </StateMessage>
      <div v-else-if="activities.length" class="activity-grid">
        <ActivityCard
          v-for="activity in activities"
          :key="activity.id"
          :activity="activity"
        />
      </div>
      <StateMessage
        v-else
        tone="empty"
        title="아직 확인된 활동이 없어요"
        body="이 조건으로 공개할 수 있는 일정과 가격 정보가 등록되면 여기에서 먼저 만날 수 있어요."
      >
        <RouterLink class="button button--outline" to="/discover"
          >지역과 날짜 바꿔보기</RouterLink
        >
      </StateMessage>
    </section>

    <section class="discovery-banner">
      <div>
        <span class="eyebrow">YOUR NEXT CHAPTER</span>
        <h2>해본 만큼,<br />나를 더 잘 알게 되니까</h2>
        <p>새로운 취향을 발견하고 나만의 경험 도감에 기록해 보세요.</p>
      </div>
      <div class="discovery-banner__stamp" aria-hidden="true">
        <span>오늘의</span><b>발견</b><i>✳</i>
      </div>
      <RouterLink class="button button--light" to="/collection"
        >나의 도감 보기 <span aria-hidden="true">→</span></RouterLink
      >
    </section>
  </div>
</template>
