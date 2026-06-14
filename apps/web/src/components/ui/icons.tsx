import type { SVGProps } from 'react';

// Heroicons-style inline SVGs (24x24, stroke). Decorative by default
// (aria-hidden); pass aria-hidden={false} + role/aria-label for meaningful use.
const base = ({ className, ...rest }: SVGProps<SVGSVGElement>) => ({
  'aria-hidden': true,
  fill: 'none',
  viewBox: '0 0 24 24',
  strokeWidth: 1.6,
  stroke: 'currentColor',
  ...rest,
  className: className ?? 'h-5 w-5',
});

export const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m21 21-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"
    />
  </svg>
);

export const UserPlusIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 7.5v6M21 10.5h-6M11 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM2.5 20a6.5 6.5 0 0 1 13 0"
    />
  </svg>
);

export const DotsVerticalIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6.75h.008v.008H12V6.75Zm0 5.25h.008v.008H12V12Zm0 5.25h.008v.008H12v-.008Z"
    />
  </svg>
);

export const ChevronDownIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
  </svg>
);

export const ChevronRightIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
  </svg>
);

export const ShieldIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3 4.5 6v5.25c0 4.5 3.2 7.5 7.5 9 4.3-1.5 7.5-4.5 7.5-9V6L12 3Zm0 5.25v3.75m0 3h.008v.008H12v-.008Z"
    />
  </svg>
);

export const WarningIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v3.75m0 3.75h.008M10.34 4.4 2.9 17.1A1.5 1.5 0 0 0 4.2 19.35h15.6a1.5 1.5 0 0 0 1.3-2.25L13.66 4.4a1.5 1.5 0 0 0-2.6 0Z"
    />
  </svg>
);

export const CopyIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 8.25H10.5a1.5 1.5 0 0 0-1.5 1.5v8.25a1.5 1.5 0 0 0 1.5 1.5h5.25a1.5 1.5 0 0 0 1.5-1.5V9.75a1.5 1.5 0 0 0-1.5-1.5Z M6.75 15.75A1.5 1.5 0 0 1 5.25 14.25V6A1.5 1.5 0 0 1 6.75 4.5H12"
    />
  </svg>
);

export const CheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m4.5 12.75 6 6 9-13.5"
    />
  </svg>
);

export const UsersIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
    />
  </svg>
);

export const ClipboardIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
    />
  </svg>
);

export const XMarkIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 18 18 6M6 6l12 12"
    />
  </svg>
);

export const InboxIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z"
    />
  </svg>
);

export const ArrowPathIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>
);
