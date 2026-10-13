<script setup lang="ts">
import { onMounted, ref } from "vue";
import AccountGate from "../components/AccountGate.vue";
import StateMessage from "../components/StateMessage.vue";
import { apiGet, apiPatch, ApiError } from "../api";

type SourceRecord = {
  record_id: string;
  source: string;
  title: string;
  region: string;
  city: string;
  starts_on: string;
  ends_on: string;
};
type MergeCase = {
  id: string;
  leftSourceRecordId: string;
  rightSourceRecordId: string;
  decision: string;
  reason: string;
  leftRecord: SourceRecord;
  rightRecord: SourceRecord;
};
const items = ref<MergeCase[]>([]);
const loading = ref(true);
const error = ref("");
const actionError = ref("");
const busyCaseId = ref("");
onMounted(async () => {
  try {
    items.value = (
      await apiGet<{ items: MergeCase[] }>("/admin/merge-cases")
    ).items;
  } catch (reason) {
    error.value =
      reason instanceof ApiError && reason.status === 401
        ? "AUTH_REQUIRED"
        : reason instanceof ApiError && reason.status === 403
          ? "FORBIDDEN"
          : "검수 대기열을 불러오지 못했어요.";
  } finally {
    loading.value = false;
  }
});

function recordPayload(value: SourceRecord | string): SourceRecord {
  return typeof value === "string"
    ? (JSON.parse(value) as SourceRecord)
    : value;
}

async function decide(
  item: MergeCase,
  decision: "SAME_EVENT" | "DIFFERENT_EVENT",
) {
  actionError.value = "";
  busyCaseId.value = item.id;
  try {
    await apiPatch(`/admin/merge-cases/${encodeURIComponent(item.id)}`, {
      decision,
    });
    items.value = items.value.filter((candidate) => candidate.id !== item.id);
  } catch (reason) {
    actionError.value =
      reason instanceof ApiError && reason.status === 409
        ? "이미 처리된 후보예요. 검수 목록을 새로고침해 주세요."
        : reason instanceof Error
          ? reason.message
          : "검수 결정을 저장하지 못했어요.";
  } finally {
    busyCaseId.value = "";
  }
}
</script>

<template>
  <div class="page-wrap simple-page admin-page">
    <header class="page-heading">
      <span class="eyebrow">OPERATIONS</span>
      <h1>콘텐츠 검수</h1>
      <p>원본 기록은 보존하고, 중복 후보는 사람이 확인한 뒤 결정합니다.</p>
    </header>
    <AccountGate
      v-if="error === 'AUTH_REQUIRED'"
      title="운영자 계정이 필요해요"
      description="검수 목록은 인증된 큐레이터와 관리자만 볼 수 있어요."
    />
    <StateMessage
      v-else-if="error === 'FORBIDDEN'"
      tone="error"
      title="이 검수 목록을 볼 권한이 없어요"
      body="큐레이터 또는 관리자 권한으로 다시 로그인해 주세요."
    />
    <StateMessage
      v-else-if="error"
      tone="error"
      title="검수 대기열을 불러오지 못했어요"
      :body="error"
    />
    <div v-else-if="loading" class="skeleton-card">
      <div></div>
      <span></span><span></span>
    </div>
    <StateMessage
      v-else-if="items.length === 0"
      tone="empty"
      title="열린 중복 후보가 없어요"
      body="새 후보가 등록되면 원본 기록을 비교할 수 있어요."
    />
    <section v-else class="merge-queue" aria-label="열린 중복 후보">
      <div class="results-heading">
        <h2>검수 대기 {{ items.length }}건</h2>
        <span class="badge badge--review">사람의 확인 필요</span>
      </div>
      <p v-if="actionError" class="field-error" role="alert">
        {{ actionError }}
      </p>
      <article v-for="item in items" :key="item.id" class="merge-card">
        <div class="merge-card__top">
          <span class="eyebrow">MERGE REVIEW · {{ item.id }}</span
          ><span class="badge badge--review">{{ item.decision }}</span>
        </div>
        <p class="merge-card__reason">{{ item.reason }}</p>
        <div class="merge-card__records">
          <div
            v-for="(rawRecord, index) in [item.leftRecord, item.rightRecord]"
            :key="index"
            class="merge-record"
          >
            <template v-if="recordPayload(rawRecord)">
              <span class="badge badge--soft">{{
                recordPayload(rawRecord).source
              }}</span>
              <h3>{{ recordPayload(rawRecord).title }}</h3>
              <p>
                {{ recordPayload(rawRecord).region }}
                {{ recordPayload(rawRecord).city }}
              </p>
              <p>
                {{ recordPayload(rawRecord).starts_on }} –
                {{ recordPayload(rawRecord).ends_on }}
              </p>
              <p class="program-card__note">
                기준일 상태와 가격은 연구 표본에서만 확인됐어요.
              </p>
            </template>
          </div>
        </div>
        <p class="merge-card__notice">
          결정은 검수 기록에 저장되고 원본은 보존돼요. 같은 행사로 분류해도 자동
          병합이나 공개 처리는 하지 않아요.
        </p>
        <div class="merge-card__actions">
          <button
            class="button button--primary"
            type="button"
            :disabled="Boolean(busyCaseId)"
            @click="decide(item, 'SAME_EVENT')"
          >
            {{ busyCaseId === item.id ? "저장 중…" : "같은 행사로 분류" }}
          </button>
          <button
            class="button button--outline"
            type="button"
            :disabled="Boolean(busyCaseId)"
            @click="decide(item, 'DIFFERENT_EVENT')"
          >
            서로 다른 행사로 분류
          </button>
        </div>
      </article>
    </section>
  </div>
</template>
