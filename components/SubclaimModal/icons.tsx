import { SVGProps } from 'react';

export function ShrinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox='0 -960 960 960' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' {...props}>
      <path d='M440-440v240h-80v-160H200v-80h240Zm160-320v160h160v80H520v-240h80Z' />
    </svg>
  );
}

export function ExpandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox='0 -960 960 960' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' {...props}>
      <path d='M200-200v-240h80v160h160v80H200Zm480-320v-160H520v-80h240v240h-80Z' />
    </svg>
  );
}

export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox='0 -960 960 960' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' {...props}>
      <path d='M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z' />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox='0 -960 960 960' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' {...props}>
      <path d='M382-200 113-469l57-57 212 212 408-408 57 57-465 465Z' />
    </svg>
  );
}

export function CrossIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox='0 -960 960 960' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' {...props}>
      <path d='m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z' />
    </svg>
  );
}

export function WarningIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox='0 -960 960 960' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' {...props}>
      <path d='M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z' />
    </svg>
  );
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox='0 -960 960 960' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' {...props}>
      <path d='m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z' />
    </svg>
  );
}
