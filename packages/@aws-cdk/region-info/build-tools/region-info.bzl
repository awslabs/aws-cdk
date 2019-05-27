# Implementation of cfn_gen that performs an action
def _region_info(ctx):
  # Define arguments that will be passed to the underlying nodejs script.
  args = ctx.actions.args()

  # The generated bundle's filename.
  args.add("--output")
  args.add(ctx.outputs.output_name.path)

  # Define an "action" that will run the nodejs_binary executable. This is
  # the main thing that cfn2ts rule does.
  ctx.actions.run(
    inputs = [],
    executable = ctx.executable._region_info,
    outputs = [ctx.outputs.output_name],
    arguments = [args],
    progress_message = "RegionInfo (%s)" % ctx.attr.output_name,
  )

  output_depset = depset([ctx.outputs.output_name])

  # The return value describes what the rule is producing. In this case we need to specify
  # the "DefaultInfo" so that the given rule target acts like a filegroup
  return [
    DefaultInfo(files = output_depset),
  ]

# Rule definition for cfn_gen that defines attributes and outputs.
region_info = rule(
  # Point to the function that will execute for this rule.
  implementation = _region_info,

  # The attributes that can be set to this rule.
  attrs = {
    # The name of the file to be output from this rule. The rule will fail if
    # the nodejs_binary does not produce this output file. By using
    # `attr.output()`, we can omit the separate `outputs` declaration a more
    # complicated rule would need.
    "output_name": attr.output(),

    # The executable (bundler) for this rule (private).
    "_region_info": attr.label(
      default = Label("//packages/@aws-cdk/region-info/build-tools:region-info-gen"),
      executable = True,
      cfg = "host"
  )},
)
