import React, { useState, useEffect, useCallback } from 'react'
import Login from './components/Login.jsx'
import DeviceSetup from './components/DeviceSetup.jsx'
import ChatView from './components/ChatView.jsx'
import { onAuthFailure } from './lib/wsAdapter.js'

function getDeviceId() {
  // Check cookie for device_id
  const match = document.cookie.match(/(?:^|;\s*)nandi_device_id=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function setDeviceIdCookie(id) {
  // Set cookie that lasts 10 years
  const expires = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `nandi_device_id=${encodeURIComponent(id)};expires=${expires};path=/;SameSite=Lax`
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [deviceId, setDeviceId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check existing auth + device on mount
    const token = localStorage.getItem('user_token')
    const savedDevice = getDeviceId()
    if (token) setIsLoggedIn(true)
    if (savedDevice) setDeviceId(savedDevice)
    setLoading(false)
    onAuthFailure(() => setIsLoggedIn(false))
  }, [])

  const handleLogin = useCallback(() => {
    setIsLoggedIn(true)
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('user_token')
    setIsLoggedIn(false)
  }, [])

  const handleDeviceSet = useCallback((name) => {
    setDeviceIdCookie(name)
    setDeviceId(name)
  }, [])

  if (loading) return null

  // Step 1: Login
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />
  }

  // Step 2: Device setup (only if no device cookie)
  if (!deviceId) {
    return <DeviceSetup onDeviceSet={handleDeviceSet} />
  }

  // Step 3: Main chat view
  return <ChatView deviceId={deviceId} onLogout={handleLogout} />
}
