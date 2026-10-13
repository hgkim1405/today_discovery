<script setup lang="ts">
import { ref, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";

const menuOpen = ref(false);
const route = useRoute();
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  },
);
const links = [
  { to: "/", label: "홈" },
  { to: "/discover", label: "경험 찾기" },
  { to: "/missions", label: "도전 미션" },
  { to: "/saved", label: "관심 목록" },
  { to: "/collection", label: "나의 도감" },
];
</script>

<template>
  <a class="skip-link" href="#main-content">본문 바로가기</a>
  <div class="site-shell">
    <header class="site-header">
      <div class="site-header__inner">
        <RouterLink class="brand" to="/" aria-label="오늘의 발견 홈">
          <span class="brand__mark" aria-hidden="true"
            ><i></i><i></i><i></i
          ></span>
          <span>오늘의 발견<small>경험을 모으는 작은 지도</small></span>
        </RouterLink>
        <nav class="desktop-nav" aria-label="주요 메뉴">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            :class="{ 'is-active': route.path === link.to }"
            >{{ link.label }}</RouterLink
          >
        </nav>
        <div class="site-header__actions">
          <RouterLink
            class="header-profile"
            to="/me"
            aria-label="설정 및 내 계정"
            >○</RouterLink
          >
          <button
            class="menu-toggle"
            type="button"
            :aria-expanded="menuOpen"
            aria-controls="mobile-menu"
            aria-label="메뉴 열기"
            @click="menuOpen = !menuOpen"
          >
            <span aria-hidden="true">{{ menuOpen ? "×" : "☰" }}</span>
          </button>
        </div>
      </div>
      <nav
        v-if="menuOpen"
        id="mobile-menu"
        class="mobile-menu"
        aria-label="모바일 메뉴"
      >
        <RouterLink v-for="link in links" :key="link.to" :to="link.to"
          >{{ link.label }}<span aria-hidden="true">→</span></RouterLink
        >
        <RouterLink to="/me">설정 <span aria-hidden="true">→</span></RouterLink>
      </nav>
    </header>
    <main id="main-content" class="main-content"><RouterView /></main>
    <nav class="mobile-dock" aria-label="빠른 메뉴">
      <RouterLink to="/" :class="{ 'is-current': route.path === '/' }"
        ><span aria-hidden="true">⌂</span>홈</RouterLink
      >
      <RouterLink
        to="/discover"
        :class="{ 'is-current': route.path.startsWith('/discover') }"
        ><span aria-hidden="true">⌕</span>찾기</RouterLink
      >
      <RouterLink to="/saved" :class="{ 'is-current': route.path === '/saved' }"
        ><span aria-hidden="true">♡</span>관심</RouterLink
      >
      <RouterLink
        to="/collection"
        :class="{ 'is-current': route.path === '/collection' }"
        ><span aria-hidden="true">▦</span>도감</RouterLink
      >
    </nav>
    <footer class="site-footer">
      <div class="site-footer__inner">
        <div class="brand brand--footer">
          <span class="brand__mark" aria-hidden="true"
            ><i></i><i></i><i></i></span
          ><span>오늘의 발견</span>
        </div>
        <p>공식 출처를 바탕으로, 확인된 정보만 전합니다.</p>
        <div>
          <RouterLink to="/me">이용 안내</RouterLink
          ><RouterLink to="/admin">운영자</RouterLink>
        </div>
      </div>
    </footer>
  </div>
</template>
