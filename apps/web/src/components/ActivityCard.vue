<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import {
  formatDateRange,
  priceLabel,
  safeHttpsUrl,
  type Activity,
} from "../api";

const props = defineProps<{ activity: Activity }>();
const source = computed(() => props.activity.sourceAttributions[0] ?? null);
const sourceUrl = computed(() => safeHttpsUrl(source.value?.sourceUrl));
const detailsUrl = computed(() =>
  safeHttpsUrl(props.activity.officialDetailUrl),
);
const icon = computed(() => {
  const icons: Record<Activity["activityType"], string> = {
    FESTIVAL: "축",
    PERFORMANCE: "공",
    EXHIBITION: "전",
    CLASS: "체",
    SPORTS: "운",
    FACILITY: "공",
    OTHER: "발",
  };
  return icons[props.activity.activityType];
});
</script>

<template>
  <article class="activity-card">
    <RouterLink
      class="activity-card__visual"
      :to="{ name: 'activity', params: { id: activity.id } }"
      :aria-label="`${activity.title} 상세 보기`"
    >
      <span class="activity-card__category">{{ icon }}</span>
      <span class="activity-card__visual-label">오늘의 발견</span>
      <span class="activity-card__spark" aria-hidden="true">✳</span>
    </RouterLink>
    <div class="activity-card__content">
      <div class="activity-card__badges">
        <span class="badge badge--soft">{{
          activity.regionCode || "지역 확인 필요"
        }}</span>
        <span
          class="badge"
          :class="`badge--${activity.priceKind.toLowerCase()}`"
          >{{ priceLabel(activity.priceKind) }}</span
        >
      </div>
      <h3>
        <RouterLink :to="{ name: 'activity', params: { id: activity.id } }">{{
          activity.title
        }}</RouterLink>
      </h3>
      <p class="activity-card__summary">
        {{
          activity.summary || "공식 안내에서 자세한 내용을 확인할 수 있어요."
        }}
      </p>
      <div class="activity-card__meta">
        <span>◷ {{ formatDateRange(activity.startOn, activity.endOn) }}</span>
        <span v-if="source && sourceUrl" class="activity-card__source">
          <a :href="sourceUrl" target="_blank" rel="noopener noreferrer"
            >공식 출처 · {{ source.sourceCode }}</a
          >
        </span>
        <span v-else>출처 연결 확인 중</span>
      </div>
      <div
        v-if="activity.bookingStatus === 'UNKNOWN'"
        class="activity-card__booking"
      >
        신청 상태 미확인
      </div>
      <a
        v-if="detailsUrl"
        class="activity-card__detail"
        :href="detailsUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        공식 안내 보기 <span aria-hidden="true">↗</span>
      </a>
    </div>
  </article>
</template>
