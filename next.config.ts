const isProd = process.env.NODE_ENV === 'production';
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // Disable default image optimization
  },
   experimental: {
    optimizeCss: false, // disable LightningCSS, fallback to PostCSS
  },
  assetPrefix: isProd ? '/ReactWeb/' : '',
  basePath: isProd ? '/ReactWeb' : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? '/ReactWeb' : ''
  },
  output: 'export'
};

export default nextConfig;
