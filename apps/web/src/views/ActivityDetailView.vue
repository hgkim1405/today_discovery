<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import StateMessage from "../components/StateMessage.vue";
import {
  apiGet,
  ApiError,
  formatDateRange,
  priceLabel,
  safeHttpsUrl,
  type ActivityDetail,
  type Program,
} from "../api";

const props = defineProps<{ id: string }>();
type Session = {
  id: string;
  startsAt: string | null;
  endsAt: string | null;
  bookingStatus: string;
  bookingUrl: string | null;
  priceKrw: number | null;
  seatsAvailable: number | null;
};
const activity = ref<ActivityDetail | null>(null);
const sessions = ref<Record<string, Session[]>>({});
const loading = ref(true);
const error = ref("");
const tab = ref<"about" | "programs" | "place" | "join">("about");
const officialUrl = computed(() =>
  safeHttpsUrl(activity.value?.officialDetailUrl),
);
const bookingLabel = computed(() => {
  switch (activity.value?.bookingStatus) {
    case "OPEN":
      return "신청 가능 확인";
    case "CLOSED":
      return "신청 마감 확인";
    case "WAITLIST":
      return "대기 신청 확인";
    case "NOT_REQUIRED":
      return "별도 신청 없음";
    default:
      return "신청 상태 미확인";
  }
});
let controller: AbortController | undefined;

function money(program: Program): string {
  if (
    program.minPriceKrw !== null &&
    program.minPriceKrw !== undefined &&
    program.maxPriceKrw !== null &&
    program.maxPriceKrw !== undefined &&
    program.minPriceKrw !== program.maxPriceKrw
  ) {
    return `${program.minPriceKrw.toLocaleString()}–${program.maxPriceKrw.toLocaleString()}원`;
  }
  const amount = program.maxPriceKrw ?? program.minPriceKrw;
  return amount === null || amount === undefined
    ? "가격 확인 필요"
    : `${amount.toLocaleString()}원`;
}

async function load() {
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  error.value = "";
  activity.value = null;
  sessions.value = {};
  try {
    const detail = await apiGet<ActivityDetail>(
      `/activities/${encodeURIComponent(props.id)}`,
      controller.signal,
    );
    activity.value = detail;
    const pairs = await Promise.all(
      detail.programs.map(async (program: Program) => {
        const result = await apiGet<{ items: Session[] }>(
          `/programs/${encodeURIComponent(program.id)}/sessions`,
          controller!.signal,
        );
        return [program.id, result.items] as const;
      }),
    );
    sessions.value = Object.fromEntries(pairs);
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === "AbortError") return;
    error.value =
      reason instanceof ApiError && reason.status === 404
        ? "이 활동은 공개 중이 아니거나 주소가 바뀌었어요."
        : reason instanceof Error
          ? reason.message
          : "활동 정보를 불러오지 못했어요.";
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.id,
  () => void load(),
  { immediate: true },
);
</script>

<template>
  <div class="page-wrap detail-page">
    <RouterLink class="back-link" to="/discover"
      ><span aria-hidden="true">←</span> 활동 목록으로</RouterLink
    >
    <div
      v-if="loading"
      class="detail-loading"
      aria-label="활동 정보를 불러오는 중"
    >
      <div class="skeleton-card">
        <div></div>
        <span></span><span></span>
      </div>
    </div>
    <StateMessage
      v-else-if="error"
      tone="error"
      title="활동을 확인할 수 없어요"
      :body="error"
      ><RouterLink class="button button--outline" to="/discover"
        >검색으로 돌아가기</RouterLink
      ></StateMessage
    >
    <template v-else-if="activity">
      <header class="detail-hero">
        <div class="detail-hero__visual" aria-hidden="true">
          <span>발견</span><i>✳</i>
        </div>
        <div class="detail-hero__copy">
          <div class="activity-card__badges">
            <span class="badge badge--soft">{{
              activity.regionCode || "지역 확인 필요"
            }}</span
            ><span
              class="badge"
              :class="`badge--${activity.priceKind.toLowerCase()}`"
              >{{ priceLabel(activity.priceKind) }}</span
            ><span class="badge badge--soft">{{
              activity.lifecycle === "PARTIAL" ? "일부 정보 확인" : "공식 확인"
            }}</span>
          </div>
          <h1>{{ activity.title }}</h1>
          <p class="detail-hero__meta">
            {{ formatDateRange(activity.startOn, activity.endOn) }}
            <span>·</span> {{ bookingLabel }}
          </p>
          <p class="detail-hero__description">
            {{
              activity.summary ||
              "공식 안내 페이지에서 활동 설명을 확인해 주세요."
            }}
          </p>
          <div class="detail-actions">
            <a
              v-if="officialUrl"
              class="button button--primary"
              :href="officialUrl"
              target="_blank"
              rel="noopener noreferrer"
              >공식 안내 보기 <span aria-hidden="true">↗</span></a
            >
            <span v-else class="button button--muted" aria-disabled="true"
              >공식 안내 링크 확인 중</span
            >
            <RouterLink
              class="button button--outline"
              to="/saved"
              aria-label="로그인 후 관심 활동으로 저장"
              >♡ 관심 활동에 저장</RouterLink
            >
          </div>
          <p class="source-note">
            일정
            {{
              activity.lastVerifiedAt
                ? `마지막 확인 ${activity.lastVerifiedAt}`
                : "최종 확인 시각 미확인"
            }}
            · 가격 {{ activity.priceNote || "세부 가격 미확인" }}
          </p>
        </div>
      </header>

      <div class="detail-tabs" role="tablist" aria-label="활동 상세 정보">
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'about'"
          @click="tab = 'about'"
        >
          소개
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'programs'"
          @click="tab = 'programs'"
        >
          일정·프로그램
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'place'"
          @click="tab = 'place'"
        >
          장소
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'join'"
          @click="tab = 'join'"
        >
          참여 방법
        </button>
      </div>

      <section v-if="tab === 'about'" class="detail-content">
        <div class="detail-section">
          <span class="eyebrow">ABOUT THIS EXPERIENCE</span>
          <h2>활동 소개</h2>
          <p>
            {{
              activity.summary ||
              "확인된 소개 문구가 아직 없어요. 주최 측 공식 안내를 확인해 주세요."
            }}
          </p>
        </div>
        <div class="detail-section">
          <span class="eyebrow">SOURCE</span>
          <h2>공식 출처</h2>
          <ul v-if="activity.sourceAttributions.length" class="source-list">
            <li
              v-for="source in activity.sourceAttributions"
              :key="source.sourceCode"
            >
              <a
                :href="safeHttpsUrl(source.sourceUrl) || undefined"
                target="_blank"
                rel="noopener noreferrer"
                >{{ source.sourceCode }} <span aria-hidden="true">↗</span></a
              ><small>{{
                source.attributionText || "원문과 출처 정보를 확인할 수 있어요."
              }}</small>
            </li>
          </ul>
          <p v-else>출처 정보를 확인하고 있어요.</p>
        </div>
      </section>

      <section v-else-if="tab === 'programs'" class="detail-content">
        <div class="detail-section">
          <span class="eyebrow">PROGRAMS & SESSIONS</span>
          <h2>일정과 프로그램</h2>
          <p>행사 일정과 개별 참여 프로그램의 가격을 따로 확인해 주세요.</p>
        </div>
        <div v-if="activity.programs.length" class="program-list">
          <article
            v-for="program in activity.programs"
            :key="program.id"
            class="program-card"
          >
            <div class="program-card__head">
              <div>
                <h3>{{ program.name }}</h3>
                <p>
                  {{
                    program.description ||
                    program.participationNote ||
                    "프로그램 상세 내용 확인 필요"
                  }}
                </p>
              </div>
              <span
                class="badge"
                :class="`badge--${program.priceKind.toLowerCase()}`"
                >{{
                  program.priceKind === "FREE"
                    ? "무료 확인"
                    : program.priceKind === "MIXED"
                      ? "일부 유료"
                      : program.priceKind === "PAID"
                        ? money(program)
                        : "가격 확인 필요"
                }}</span
              >
            </div>
            <p v-if="program.priceKind === 'PAID'" class="program-card__price">
              {{ money(program) }}
            </p>
            <div v-if="sessions[program.id]?.length" class="session-list">
              <div
                v-for="session in sessions[program.id]"
                :key="session.id"
                class="session-row"
              >
                <span>{{ session.startsAt || "시간 확인 필요" }}</span
                ><span>{{
                  session.priceKrw === null
                    ? "회차 가격 미확인"
                    : `${session.priceKrw.toLocaleString()}원`
                }}</span
                ><a
                  v-if="safeHttpsUrl(session.bookingUrl)"
                  class="text-link"
                  :href="safeHttpsUrl(session.bookingUrl)!"
                  target="_blank"
                  rel="noopener noreferrer"
                  >신청 페이지 이동 ↗</a
                ><span v-else>신청 상태 미확인</span>
              </div>
            </div>
            <p v-else class="program-card__note">
              회차별 실제 시각과 신청 링크가 확인되지 않았어요.
            </p>
          </article>
        </div>
        <StateMessage
          v-else
          tone="empty"
          title="등록된 프로그램이 없어요"
          body="확인된 프로그램과 회차가 추가되면 이곳에서 행사와 구분해 보여드릴게요."
        />
      </section>

      <section v-else-if="tab === 'place'" class="detail-content">
        <div class="detail-section">
          <span class="eyebrow">WHERE IT HAPPENS</span>
          <h2>장소</h2>
          <p>{{ activity.place?.name || "장소 확인 필요" }}</p>
          <p>
            {{
              activity.place?.address ||
              "주소가 공식 출처에서 확인되지 않았어요."
            }}
          </p>
          <p
            v-if="
              activity.place?.lat === null || activity.place?.lat === undefined
            "
            class="program-card__note"
          >
            확인된 좌표가 없어 지도는 표시하지 않아요.
          </p>
        </div>
      </section>

      <section v-else class="detail-content">
        <div class="detail-section">
          <span class="eyebrow">HOW TO JOIN</span>
          <h2>참여 방법</h2>
          <p>
            현재 신청 상태와 잔여 좌석은 확인되지 않았어요. 예약 가능 여부를
            추측하지 않습니다.
          </p>
          <a
            v-if="officialUrl"
            class="button button--outline"
            :href="officialUrl"
            target="_blank"
            rel="noopener noreferrer"
            >주최 측 안내에서 확인하기 <span aria-hidden="true">↗</span></a
          >
        </div>
      </section>
    </template>
  </div>
</template>
