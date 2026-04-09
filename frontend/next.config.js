/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:3000/:path*',
      },
    ]
  },
}

module.exports = nextConfig