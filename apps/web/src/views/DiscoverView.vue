<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ActivityCard from "../components/ActivityCard.vue";
import StateMessage from "../components/StateMessage.vue";
import {
  ApiError,
  searchActivities,
  type Activity,
  type ActivitySearch,
} from "../api";

const regions = [
  "강원",
  "경기",
  "경남",
  "경북",
  "광주",
  "대구",
  "대전",
  "부산",
  "서울",
  "세종",
  "울산",
  "인천",
  "전남",
  "전북",
  "제주",
  "충남",
  "충북",
];
const kinds = [
  { value: "FESTIVAL", label: "축제·행사" },
  { value: "PERFORMANCE", label: "공연" },
  { value: "EXHIBITION", label: "전시" },
  { value: "CLASS", label: "체험·강좌" },
  { value: "SPORTS", label: "스포츠" },
  { value: "FACILITY", label: "공간·시설" },
  { value: "OTHER", label: "기타" },
] as const;

const route = useRoute();
const router = useRouter();
const region = ref("");
const from = ref("");
const to = ref("");
const maxPrice = ref("");
const freeOnly = ref(false);
const activityType = ref("");
const keyword = ref("");
const items = ref<Activity[]>([]);
const nextCursor = ref<string | null>(null);
const loading = ref(true);
const error = ref("");
const queryError = computed(() =>
  Boolean(from.value && to.value && from.value > to.value),
);
let controller: AbortController | undefined;

function valueOf(key: string): string {
  const value = route.query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function syncForm() {
  region.value = valueOf("region");
  from.value = valueOf("from");
  to.value = valueOf("to");
  maxPrice.value = valueOf("maxConfirmedPriceKrw");
  freeOnly.value = valueOf("freeOnly") === "true";
  activityType.value = valueOf("activityType");
  keyword.value = valueOf("query");
}

function searchFromRoute(): ActivitySearch {
  const search: ActivitySearch = { limit: 12 };
  if (valueOf("region")) search.region = valueOf("region");
  if (valueOf("from")) search.from = valueOf("from");
  if (valueOf("to")) search.to = valueOf("to");
  if (valueOf("maxConfirmedPriceKrw"))
    search.maxConfirmedPriceKrw = Number(valueOf("maxConfirmedPriceKrw"));
  if (valueOf("freeOnly") === "true") search.freeOnly = true;
  if (valueOf("activityType"))
    search.activityType = valueOf(
      "activityType",
    ) as ActivitySearch["activityType"];
  if (valueOf("query")) search.query = valueOf("query");
  if (valueOf("cursor")) search.cursor = valueOf("cursor");
  return search;
}

async function loadResults() {
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  error.value = "";
  try {
    const page = await searchActivities(searchFromRoute(), controller.signal);
    items.value = page.items;
    nextCursor.value = page.nextCursor;
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === "AbortError") return;
    error.value =
      reason instanceof ApiError
        ? reason.message
        : "검색 결과를 불러오지 못했어요.";
    items.value = [];
  } finally {
    loading.value = false;
  }
}

async function applyFilters() {
  if (queryError.value) return;
  const query: Record<string, string> = {};
  if (region.value) query.region = region.value;
  if (from.value) query.from = from.value;
  if (to.value) query.to = to.value;
  if (maxPrice.value) query.maxConfirmedPriceKrw = maxPrice.value;
  if (freeOnly.value) query.freeOnly = "true";
  if (activityType.value) query.activityType = activityType.value;
  if (keyword.value.trim()) query.query = keyword.value.trim();
  await router.push({ path: "/discover", query });
}

async function clearFilters() {
  await router.push("/discover");
}

async function nextPage() {
  if (!nextCursor.value) return;
  const query = { ...route.query, cursor: nextCursor.value };
  await router.push({ path: "/discover", query });
}

watch(
  () => route.fullPath,
  () => {
    syncForm();
    void loadResults();
  },
  { immediate: true },
);
</script>

<template>
  <div class="page-wrap discover-page">
    <header class="page-heading page-heading--wide">
      <div>
        <span class="eyebrow">FIND YOUR NEXT EXPERIENCE</span>
        <h1>새로운 경험 찾기</h1>
        <p>
          지역과 일정에 맞는 활동을 살펴보세요. 확인되지 않은 정보는 따로
          표시해요.
        </p>
      </div>
      <div class="heading-art" aria-hidden="true">
        <span>발견</span><i>✳</i>
      </div>
    </header>

    <section class="filter-panel" aria-labelledby="filter-title">
      <div class="filter-panel__top">
        <div>
          <span class="eyebrow">YOUR FILTERS</span>
          <h2 id="filter-title">원하는 조건을 골라주세요</h2>
        </div>
        <button class="text-button" type="button" @click="clearFilters">
          조건 초기화
        </button>
      </div>
      <form class="filter-grid" @submit.prevent="applyFilters">
        <label class="field"
          ><span>지역</span
          ><select v-model="region">
            <option value="">전국</option>
            <option v-for="item in regions" :key="item" :value="item">
              {{ item }}
            </option>
          </select></label
        >
        <label class="field"
          ><span>시작일</span><input v-model="from" type="date"
        /></label>
        <label class="field"
          ><span>종료일</span><input v-model="to" type="date"
        /></label>
        <label class="field"
          ><span>경험 종류</span
          ><select v-model="activityType">
            <option value="">모든 종류</option>
            <option v-for="kind in kinds" :key="kind.value" :value="kind.value">
              {{ kind.label }}
            </option>
          </select></label
        >
        <label class="field"
          ><span>최대 확인 가격</span
          ><select v-model="maxPrice">
            <option value="">가격 조건 없음</option>
            <option value="5000">5천원 이하</option>
            <option value="10000">1만원 이하</option>
            <option value="20000">2만원 이하</option>
          </select></label
        >
        <label class="field field--keyword"
          ><span>이름으로 찾기</span
          ><input
            v-model="keyword"
            maxlength="100"
            type="search"
            placeholder="예: 커피, 축제, 도예"
        /></label>
        <label class="check-field"
          ><input v-model="freeOnly" type="checkbox" /><span
            class="check-field__box"
            aria-hidden="true"
            >✓</span
          ><span>무료 확인 활동만</span></label
        >
        <div class="filter-submit">
          <button
            class="button button--primary"
            type="submit"
            :disabled="queryError"
          >
            조건으로 검색 <span aria-hidden="true">→</span>
          </button>
        </div>
        <p v-if="queryError" class="field-error" role="alert">
          종료일은 시작일과 같거나 이후 날짜여야 해요.
        </p>
      </form>
    </section>

    <section class="results-section" aria-live="polite">
      <div class="results-heading">
        <div>
          <span class="eyebrow">DISCOVERY LIST</span>
          <h2>
            확인된 활동 <span v-if="!loading">{{ items.length }}</span>
          </h2>
        </div>
        <span class="results-note"
          >무료 필터에는 일부 유료·가격 미확인 활동이 포함되지 않아요.</span
        >
      </div>
      <div v-if="loading && items.length === 0" class="activity-grid">
        <div v-for="number in 3" :key="number" class="skeleton-card">
          <div></div>
          <span></span><span></span>
        </div>
      </div>
      <StateMessage
        v-else-if="error"
        tone="error"
        title="검색을 마치지 못했어요"
        :body="error"
        ><button
          class="button button--outline"
          type="button"
          @click="loadResults()"
        >
          다시 시도
        </button></StateMessage
      >
      <div v-else-if="items.length" class="activity-grid">
        <ActivityCard
          v-for="activity in items"
          :key="activity.id"
          :activity="activity"
        />
      </div>
      <StateMessage
        v-else-if="!loading"
        tone="empty"
        title="조건에 맞는 확인된 활동이 없어요"
        :body="
          region
            ? `${region} 지역에 공개 가능한 일정이 아직 등록되지 않았어요. 기간이나 가격 조건을 넓혀 다시 살펴보세요.`
            : '공개 가능한 일정이 아직 등록되지 않았어요. 기간이나 가격 조건을 넓혀 다시 살펴보세요.'
        "
      >
        <div class="empty-actions">
          <button
            class="button button--outline"
            type="button"
            @click="clearFilters"
          >
            조건 초기화</button
          ><button
            class="text-button"
            type="button"
            @click="
              to = '';
              maxPrice = '';
              freeOnly = false;
              applyFilters();
            "
          >
            기간과 가격 넓히기
          </button>
        </div>
      </StateMessage>
      <div v-if="nextCursor" class="pagination">
        <button
          class="button button--outline"
          type="button"
          :disabled="loading"
          @click="nextPage"
        >
          다음 활동 보기 <span aria-hidden="true">↓</span>
        </button>
      </div>
    </section>
    <p class="data-note">
      <span aria-hidden="true">ⓘ</span> 날짜는 행사 일정이고 신청 가능 여부는
      별도예요. 실제 모집 상태와 잔여 좌석은 주최 측 공식 안내를 확인해 주세요.
    </p>
  </div>
</template>
