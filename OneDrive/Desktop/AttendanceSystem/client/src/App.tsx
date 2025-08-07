import { useState } from 'react'
import './App.css'
import { Route, Routes } from "react-router-dom";
import CameraRoom from './page/cameraRoom/CameraRoom';

function App() {

  return (
    <>
      <Routes>
        <Route path="*" element={<CameraRoom />} />
      </Routes>
    </>
  )
}

export default App