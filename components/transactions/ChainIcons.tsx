'use client';

import Image from 'next/image';

interface ChainIconProps {
  chain: string;
  size?: number;
}

export const ChainIcon = ({ chain, size = 24 }: ChainIconProps) => {
  const chainLower = chain.toLowerCase();

  // Official brand logos
  const logoMap: Record<string, string> = {
    base: '/brand/base-mark.png',
    stellar: '/brand/stellar-mark.png',
    polygon: '/brand/polygon-mark.png',
    // Fallback colors for chains without official marks
    ethereum: '#627EEA',
    optimism: '#FF0420',
    arc: '#8B5CF6',
    solana: '#14F195',
  };

  const logo = logoMap[chainLower];

  // If we have an official logo
  if (logo && !logo.startsWith('#')) {
    return (
      <Image
        src={logo}
        alt={chain}
        width={size}
        height={size}
        className="ep-chain-logo"
        style={{ width: size, height: size }}
      />
    );
  }

  // Fallback: colored badge with chain abbreviation
  const color = logo || '#999';
  const abbrev = chain.slice(0, 1).toUpperCase();

  return (
    <div
      className="ep-chain-badge"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
        fontSize: '10px',
        color: 'white',
        fontWeight: 'bold',
      }}
    >
      {abbrev}
    </div>
  );
};
