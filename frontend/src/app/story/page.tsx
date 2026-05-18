import type { Metadata } from 'next';
import DexStoryScroll from '@/components/dex/DexStoryScroll';

export const metadata: Metadata = {
  title: 'How DEX Works — DEX',
  description:
    'Scroll through how DEX parses your codebase into a real AST + dependency graph, and answers questions with grounded citations.',
};

export default function StoryPage() {
  return <DexStoryScroll />;
}
