import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import DiscoverView from "./views/DiscoverView.vue";
import ActivityDetailView from "./views/ActivityDetailView.vue";
import SavedView from "./views/SavedView.vue";
import MissionsView from "./views/MissionsView.vue";
import CollectionView from "./views/CollectionView.vue";
import ShareView from "./views/ShareView.vue";
import SettingsView from "./views/SettingsView.vue";
import AdminView from "./views/AdminView.vue";

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/discover", name: "discover", component: DiscoverView },
    {
      path: "/activities/:id",
      name: "activity",
      component: ActivityDetailView,
      props: true,
    },
    { path: "/saved", name: "saved", component: SavedView },
    { path: "/missions", name: "missions", component: MissionsView },
    { path: "/collection", name: "collection", component: CollectionView },
    { path: "/share/:token", name: "share", component: ShareView, props: true },
    { path: "/me", name: "settings", component: SettingsView },
    { path: "/admin", name: "admin", component: AdminView },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
