import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useBlocker, useLocation, useNavigate } from 'react-router';
import { createControllerClass } from './CosmosController.js';
import { connectSync } from './sync';

export type Controller = InstanceType<ReturnType<typeof createControllerClass>>;
type RenderResult = ReturnType<Controller['renderVals']>;
type UnionKeys<T> = T extends unknown ? keyof T : never;
type UnionValue<T, K extends PropertyKey> = T extends unknown ? (K extends keyof T ? T[K] : never) : never;
export type ViewModel = { [K in UnionKeys<RenderResult>]?: UnionValue<RenderResult, K> };
export type CosmosContextValue = { controller: Controller; values: ViewModel };
export const CosmosContext = createContext<CosmosContextValue | null>(null);
export function useCosmos() {
  const value = useContext(CosmosContext);
  if (!value) throw new Error('CosmosProvider manquant');
  return value;
}
export function CosmosProvider({
  children,
  createController,
}: {
  children: ReactNode;
  createController?: () => Controller;
}) {
  const [controller] = useState(() =>
    createController
      ? createController()
      : new (createControllerClass({ makeSync: connectSync }))({ author: 'Toi' }),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const navigate = useNavigate();
  const location = useLocation();
  const blocker = useBlocker(() => !controller.finishEdit());
  useEffect(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);
  useLayoutEffect(() => {
    controller.routerNavigate = navigate;
    controller.applyRoute(location.pathname);
  }, [controller, navigate, location.pathname]);
  useEffect(() => {
    controller.componentDidMount();
    return () => controller.componentWillUnmount();
  }, [controller]);
  useEffect(() => {
    controller.componentDidUpdate();
  }, [controller, state]);
  const value = useMemo(() => ({ controller, values: controller.renderVals() }), [controller, state]);
  return <CosmosContext value={value}>{children}</CosmosContext>;
}
