import { Fragment } from "react";

export default function LinkedText({ template, links }) {
  const parts = template.split(/(\{\w+\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = /^\{(\w+)\}$/.exec(part);
        return <Fragment key={i}>{match && match[1] in links ? links[match[1]] : part}</Fragment>;
      })}
    </>
  );
}
