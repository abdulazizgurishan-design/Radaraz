import Head from 'next/head';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    window.location.replace('/landing.html');
  }, []);
  return null;
}
