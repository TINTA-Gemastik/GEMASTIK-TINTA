'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { Button } from './button'

export interface Notification {
  id:      string
  title:   string
  body:    string
  read:    boolean
  time:    string
}

interface NotificationPopoverProps {
  notifications?: Notification[]
}

export function NotificationPopover({ notifications = [] }: NotificationPopoverProps) {
  const [open, setOpen]   = useState(false)
  const unread = notifications.filter(n => !n.read).length

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(o => !o)}
        className="relative text-[#B9B6AD] hover:text-[#2D4E71]"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 z-50 w-80 bg-white rounded-xl shadow-xl border border-[#B9B6AD]/20 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-[#B9B6AD]/15 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#111111]">Notifications</p>
                {unread > 0 && (
                  <span className="text-xs text-amber-600 font-medium">{unread} new</span>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-[#B9B6AD]">
                  No notifications yet
                </div>
              ) : (
                <ul className="divide-y divide-[#B9B6AD]/10 max-h-72 overflow-y-auto">
                  {notifications.map(n => (
                    <li
                      key={n.id}
                      className={`px-4 py-3 ${n.read ? '' : 'bg-blue-50/40'}`}
                    >
                      <p className="text-xs font-medium text-[#111111]">{n.title}</p>
                      <p className="text-xs text-[#B9B6AD] mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-[#B9B6AD]/70 mt-1">{n.time}</p>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
