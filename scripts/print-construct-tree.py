#!/usr/bin/env python
"""Print the construct tree from a cdk.out directory."""
import sys
import argparse
from os import path
import json


def main():
  dirname = sys.argv[1]
  parser = argparse.ArgumentParser(description='Print the construct tree from a cdk.out directory')
  parser.add_argument('dir', metavar='DIR', type=str, nargs=1, default='cdk.out',
                      help='cdk.out directory')

  args = parser.parse_args()
  print_tree_file(path.join(args.dir[0], 'tree.json'))


def print_tree_file(tree_file_name):
  with open(tree_file_name, 'r') as f:
    contents = json.load(f)
  print_tree(contents)


def print_tree(tree_file):
  print_node(tree_file['tree'])


def print_node(node, prefix_here='', prefix_children=''):
  info = []
  cfn_type = node.get('attributes', {}).get('aws:cdk:cloudformation:type')
  if cfn_type:
    info.append(cfn_type)

  print(prefix_here + node['id'] + (('  (' + ', '.join(info) + ')') if info else ''))
  children = list(node.get('children', {}).values())
  for i, child in enumerate(children):
    if i < len(children) - 1:
      print_node(child, prefix_children + ' ├─ ', prefix_children + ' │  ')
    else:
      print_node(child, prefix_children + ' └─ ', prefix_children + '    ')


if __name__ == '__main__':
  main()
