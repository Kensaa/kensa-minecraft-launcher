import React from 'react'

export default function GameStartingOverlay() {
  return (
    <div className="d-flex flex-column justify-content-center align-items-center overlay user-select-none">
        <h1>The game is starting</h1>
        <h1>please wait</h1>
        <h3>{"the first launch could be very long (up to 10min), don't panic"}</h3>
    </div>
  )
}
