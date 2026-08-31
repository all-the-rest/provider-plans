import { RouterProvider } from "./router";
import AppRoutes from "./AppRoutes";

export default function App() {
  return (
    <RouterProvider>
      <AppRoutes />
    </RouterProvider>
  );
}