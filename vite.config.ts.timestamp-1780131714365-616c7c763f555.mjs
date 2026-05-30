// vite.config.ts
import { defineConfig } from "file:///sessions/elegant-clever-cannon/mnt/outputs/paperdex/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/elegant-clever-cannon/mnt/outputs/paperdex/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/gt": {
        target: "https://api.geckoterminal.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/gt/, "")
      },
      "/ds": {
        target: "https://api.dexscreener.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ds/, "")
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZWxlZ2FudC1jbGV2ZXItY2Fubm9uL21udC9vdXRwdXRzL3BhcGVyZGV4XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvc2Vzc2lvbnMvZWxlZ2FudC1jbGV2ZXItY2Fubm9uL21udC9vdXRwdXRzL3BhcGVyZGV4L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9zZXNzaW9ucy9lbGVnYW50LWNsZXZlci1jYW5ub24vbW50L291dHB1dHMvcGFwZXJkZXgvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG4vLyBEZXYgcHJveHk6IGF2b2lkcyBhbnkgQ09SUyBlZGdlIGNhc2VzIHdoaWxlIGRldmVsb3BpbmcuXG4vLyBJbiBwcm9kdWN0aW9uIGJvdGggQVBJcyBhcmUgcHVibGljICsgQ09SUy1lbmFibGVkLCBzbyB0aGUgYXBwIGNhbGxzIHRoZW0gZGlyZWN0bHkuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIHNlcnZlcjoge1xuICAgIHByb3h5OiB7XG4gICAgICAnL2d0Jzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwczovL2FwaS5nZWNrb3Rlcm1pbmFsLmNvbScsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgcmV3cml0ZTogKHApID0+IHAucmVwbGFjZSgvXlxcL2d0LywgJycpLFxuICAgICAgfSxcbiAgICAgICcvZHMnOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHBzOi8vYXBpLmRleHNjcmVlbmVyLmNvbScsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgcmV3cml0ZTogKHApID0+IHAucmVwbGFjZSgvXlxcL2RzLywgJycpLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBOFUsU0FBUyxvQkFBb0I7QUFDM1csT0FBTyxXQUFXO0FBSWxCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixRQUFRO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxPQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxTQUFTLENBQUMsTUFBTSxFQUFFLFFBQVEsU0FBUyxFQUFFO0FBQUEsTUFDdkM7QUFBQSxNQUNBLE9BQU87QUFBQSxRQUNMLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFNBQVMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxTQUFTLEVBQUU7QUFBQSxNQUN2QztBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
