import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { ArchivePage } from '@/features/archive/ArchivePage';
import { CameraPage } from '@/features/capture/CameraPage';
import { CapturesPage } from '@/features/capture/CapturesPage';
import { HomePage } from '@/features/home/HomePage';
import { PhotoPage } from '@/features/results/PhotoPage';
import { ReportPage } from '@/features/results/ReportPage';
import { ResultsPage } from '@/features/results/ResultsPage';
import { ReviewPage } from '@/features/results/ReviewPage';
import { StorePage } from '@/features/stores/StorePage';
import { StoresPage } from '@/features/stores/StoresPage';
import { ProcessingPage } from '@/features/visit/ProcessingPage';
import { NotFound } from '@/features/shared/NotFound';
import { RootLayout } from './RootLayout';

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: NotFound });

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });
const storesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/stores', component: StoresPage });
const archiveRoute = createRoute({ getParentRoute: () => rootRoute, path: '/archive', component: ArchivePage });

const storeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stores/$storeId',
  component: function StoreRoute() {
    const { storeId } = storeRoute.useParams();
    return <StorePage storeId={storeId} />;
  },
});

const cameraRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/visits/$visitId/camera',
  component: function CameraRoute() {
    const { visitId } = cameraRoute.useParams();
    return <CameraPage visitId={visitId} />;
  },
});

const retakeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/visits/$visitId/retake/$captureId',
  component: function RetakeRoute() {
    const { visitId, captureId } = retakeRoute.useParams();
    return <CameraPage visitId={visitId} retakeCaptureId={captureId} />;
  },
});

const capturesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/visits/$visitId/captures',
  component: function CapturesRoute() {
    const { visitId } = capturesRoute.useParams();
    return <CapturesPage visitId={visitId} />;
  },
});

const processingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/visits/$visitId/processing',
  component: function ProcessingRoute() {
    const { visitId } = processingRoute.useParams();
    return <ProcessingPage visitId={visitId} />;
  },
});

const resultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/visits/$visitId/results',
  component: function ResultsRoute() {
    const { visitId } = resultsRoute.useParams();
    return <ResultsPage visitId={visitId} />;
  },
});

const reportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/visits/$visitId/report',
  component: function ReportRoute() {
    const { visitId } = reportRoute.useParams();
    return <ReportPage visitId={visitId} />;
  },
});

const photoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/visits/$visitId/photos/$captureId',
  component: function PhotoRoute() {
    const { visitId, captureId } = photoRoute.useParams();
    return <PhotoPage visitId={visitId} captureId={captureId} />;
  },
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/visits/$visitId/review',
  component: function ReviewRoute() {
    const { visitId } = reviewRoute.useParams();
    return <ReviewPage visitId={visitId} />;
  },
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  storesRoute,
  archiveRoute,
  storeRoute,
  cameraRoute,
  retakeRoute,
  capturesRoute,
  processingRoute,
  resultsRoute,
  reportRoute,
  photoRoute,
  reviewRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
