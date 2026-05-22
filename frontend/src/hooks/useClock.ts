import { useEffect, useState } from 'react';

export function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDigit = (num: number) => num.toString().padStart(2, '0');

  const timeString = `${formatDigit(now.getHours())}:${formatDigit(now.getMinutes())}:${formatDigit(now.getSeconds())}`;
  
  const dateString = `${formatDigit(now.getDate())}/${formatDigit(now.getMonth() + 1)}/${now.getFullYear()}`;

  return { timeString, dateString, rawDate: now };
}
