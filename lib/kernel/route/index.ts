/** Default route services bound to the real registry, content index and visible-OS set. */
import { contentIndex } from '@/data/content-index';
import { publicEnv } from '@/lib/config/environment';
import { OS_REGISTRY, visibleOses } from '../registry';
import type { RouteState } from '../types';
import { createRouteCodec } from './codec';
import { goStaticParams, osStaticParams } from './static-params';
import { titleFor } from './title';

export const VISIBLE_OSES = visibleOses(publicEnv.osPreview, OS_REGISTRY);

export const routeCodec = createRouteCodec({ registry: OS_REGISTRY, catalog: contentIndex, visible: VISIBLE_OSES });

export const routeTitle = (route: RouteState): string =>
  titleFor(route, { catalog: contentIndex, registry: OS_REGISTRY });

export const staticOsParams = () =>
  osStaticParams({ registry: OS_REGISTRY, catalog: contentIndex, visible: VISIBLE_OSES }, routeCodec);

export const staticGoParams = () => goStaticParams(contentIndex, routeCodec);

export * from './codec';
export * from './title';
export * from './static-params';
