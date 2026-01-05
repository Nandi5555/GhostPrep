import { css } from '../../assets/lit-core-2.7.4.min.js';

export const scrollbarStyles = css`
  /* Works for WebKit browsers (Chrome, Edge, Safari) */
  ::-webkit-scrollbar {
    width: 5px; /* width of vertical scrollbar */
    height: 5px; /* height of horizontal scrollbar */
  }

  ::-webkit-scrollbar-track {
    background: var(--app-scrollbar-track, transparent);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background-color: var(--app-scrollbar-thumb, rgba(255, 255, 255, 0.30)); /* thumb color */
    border-radius: 4px;
    border: 1px solid var(--app-scrollbar-thumb-border, rgba(255, 255, 255, 0.16)); /* adds spacing effect */
    background-clip: padding-box;
  }

  ::-webkit-scrollbar-thumb:hover {
    background-color: var(--app-scrollbar-thumb-hover, rgba(255, 255, 255, 0.42)); /* hover effect */
  }

  /* For Firefox */
  scrollbar-width: thin;
  /* Syntax: scrollbar-color: <thumb> <track> */
  scrollbar-color: var(--app-scrollbar-thumb, rgba(255, 255, 255, 0.30)) var(--app-scrollbar-track, transparent);

  /* For all scrollable elements */
  :host {
    scrollbar-width: thin;
    scrollbar-color: var(--app-scrollbar-thumb, rgba(255, 255, 255, 0.30)) var(--app-scrollbar-track, transparent);
  }
`;
