import { useEffect, useState } from "react";
import { readPicture } from "@/lib/cards/db";

export function useLocalPicture(wordId: string | null, hasPicture: boolean, rev: number): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!wordId || !hasPicture) {
      setUrl(null);
      return;
    }
    let dead = false;
    let objectUrl: string | null = null;
    void readPicture(wordId).then((picture) => {
      if (dead || !picture) return;
      objectUrl = URL.createObjectURL(picture.blob);
      setUrl(objectUrl);
    });
    return () => {
      dead = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [wordId, hasPicture, rev]);
  return url;
}
