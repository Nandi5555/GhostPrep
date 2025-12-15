import { css } from '../../assets/lit-core-2.7.4.min.js';

export const scrollbarStyles = css`
  /* Works for WebKit browsers (Chrome, Edge, Safari) */
  ::-webkit-scrollbar {
    width: 5px; /* width of vertical scrollbar */
    height: 5px; /* height of horizontal scrollbar */
  }

  ::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background-color: #555; /* thumb color */
    border-radius: 4px;
    border: 2px; /* adds spacing effect */
  }

  ::-webkit-scrollbar-thumb:hover {
    background-color: #888; /* hover effect */
  }

  /* For Firefox */
  scrollbar-width: thin;
  /* Syntax: scrollbar-color: <thumb> <track> */
  scrollbar-color: #555 rgba(83, 83, 83, 0.47);

  /* For all scrollable elements */
  :host {
    scrollbar-width: thin;
    scrollbar-color: #555 rgba(83, 83, 83, 0.47);
  }
`;
