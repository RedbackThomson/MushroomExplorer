import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, lazy: () => import('@/routes/Home').then((m) => ({ Component: m.default })) },
      {
        path: 'items',
        lazy: () => import('@/routes/Items').then((m) => ({ Component: m.default })),
      },
      {
        path: 'equips',
        lazy: () => import('@/routes/Equips').then((m) => ({ Component: m.default })),
      },
      { path: 'mobs', lazy: () => import('@/routes/Mobs').then((m) => ({ Component: m.default })) },
      { path: 'npcs', lazy: () => import('@/routes/Npcs').then((m) => ({ Component: m.default })) },
      { path: 'maps', lazy: () => import('@/routes/Maps').then((m) => ({ Component: m.default })) },
      {
        path: 'quests',
        lazy: () => import('@/routes/Quests').then((m) => ({ Component: m.default })),
      },
      {
        path: '*',
        lazy: () => import('@/routes/NotFound').then((m) => ({ Component: m.default })),
      },
    ],
  },
]);
