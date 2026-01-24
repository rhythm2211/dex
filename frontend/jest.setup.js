// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8001'
process.env.INTERNAL_API_URL = 'http://backend:8000'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
