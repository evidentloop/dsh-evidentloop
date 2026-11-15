declare module "*.css" {
  const css: string;
  export default css;
}
interface Window {
  Diff2HtmlUI?: new (
    element: HTMLElement,
    patch: string,
    config: Record<string, unknown>,
  ) => {
    draw(): void;
    highlightCode(): void;
  };
}
