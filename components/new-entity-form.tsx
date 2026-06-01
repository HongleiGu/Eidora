import EntityForm from "./entity-form";
import type { EntityFormProps } from "./entity-form";

export default function NewEntityForm(props: Omit<EntityFormProps, "mode">) {
  return <EntityForm {...props} mode="create" />;
}
