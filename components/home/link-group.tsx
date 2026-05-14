import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LinkItem } from "@/components/home/link-item";
import type { PublicLinkGroup } from "@/lib/public-links";

interface LinkGroupProps {
  group: PublicLinkGroup;
}

export function LinkGroup({ group }: LinkGroupProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{group.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-2 pb-2">
        {group.items.map((item) => (
          <LinkItem key={item.url} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}
